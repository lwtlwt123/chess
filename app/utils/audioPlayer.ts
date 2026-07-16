// key 是业务里调用的名字，value 是 public 目录下的音频路径。
type SoundMap = Record<string, string>
interface PlayOptions {
  loop?: boolean
}

type PendingPlay = {
  key: string
  options: PlayOptions
}

type WebAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

class AudioPlayer {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private audioBuffers: Record<string, AudioBuffer> = {}
  private loadingBuffers: Record<string, Promise<void>> = {}
  private fallbackPool: Record<string, HTMLAudioElement> = {}
  private activeSources = new Map<AudioBufferSourceNode, string>()
  private loopSources: Record<string, AudioBufferSourceNode> = {}
  private pendingPlays: PendingPlay[] = []
  private unlockHandler: (() => void) | null = null
  private hasUnlockedAudio = false
  private hasPrimedOutput = false
  private isFlushingPendingPlays = false

  /**
   * 批量预加载并解码音效。
   * 预加载后，就可以用 play(key) 播放。
   */
  preload(soundList: SoundMap): void {
    Object.entries(soundList).forEach(([key, src]) => {
      this.createFallbackAudio(key, src)
      this.loadAudioBuffer(key, src)
    })

    this.bindUnlockEvents()
  }

  /**
   * 播放指定音效。
   * key 必须和 preload 里传入的 key 一致。
   */
  play(key: string, options: PlayOptions = {}): void {
    const { loop = false } = options
    const audioContext = this.getAudioContext()
    const audioBuffer = this.audioBuffers[key]

    if (audioContext && this.masterGain && audioBuffer) {
      if (this.shouldDeferPlayback()) {
        this.queuePlay(key, options)
        return
      }

      if (loop) {
        this.stop(key)
      }

      if (audioContext.state === 'suspended') {
        this.unlock()
      }

      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.loop = loop
      source.connect(this.masterGain)
      source.onended = () => {
        this.activeSources.delete(source)

        if (this.loopSources[key] === source) {
          delete this.loopSources[key]
        }
      }

      this.activeSources.set(source, key)

      if (loop) {
        this.loopSources[key] = source
      }

      source.start(0)
      return
    }

    const audio = this.fallbackPool[key]
    if (!audio) {
      console.warn(`音效【${key}】未预加载`)
      return
    }

    if (this.shouldDeferPlayback()) {
      this.queuePlay(key, options)
      return
    }

    // 重置播放头，快速重复点击也能立刻重新响。
    audio.loop = loop
    audio.currentTime = 0
    audio.play().catch((err) => {
      if (this.isAutoplayBlockedError(err)) {
        this.queuePlay(key, options)
        return
      }

      console.warn(`音效【${key}】播放失败`, err)
    })
  }

  /**
   * 浏览器首次用户手势时解锁音频输出。
   * preload 只负责下载/解码，真正可播放还需要这一步。
   */
  unlock(): void {
    const audioContext = this.getAudioContext()
    if (!audioContext) {
      this.hasUnlockedAudio = true
      this.flushPendingPlays()
      this.unbindUnlockEvents()
      return
    }

    const afterResume = audioContext.state === 'suspended'
      ? audioContext.resume()
      : Promise.resolve()

    void afterResume
      .then(() => {
        this.hasUnlockedAudio = true
        this.primeOutput()
        this.flushPendingPlays()
        this.unbindUnlockEvents()
      })
      .catch((err) => {
        console.warn('音频解锁失败：需用户交互触发', err)
        this.bindUnlockEvents()
      })
  }

  /**
   * 停止全部音效并重置播放头。
   */
  stopAll(): void {
    this.pendingPlays = []

    this.activeSources.forEach((_key, source) => {
      source.stop()
    })
    this.activeSources.clear()
    this.loopSources = {}

    Object.values(this.fallbackPool).forEach((audio) => {
      audio.pause()
      audio.currentTime = 0
    })
  }

  /**
   * 停止指定音效。BGM 这种循环音频会用到。
   */
  stop(key: string): void {
    this.pendingPlays = this.pendingPlays.filter((pendingPlay) => pendingPlay.key !== key)

    const loopSource = this.loopSources[key]

    if (loopSource) {
      loopSource.stop()
      this.activeSources.delete(loopSource)
      delete this.loopSources[key]
    }

    this.activeSources.forEach((sourceKey, source) => {
      if (sourceKey === key) {
        source.stop()
        this.activeSources.delete(source)
      }
    })

    const fallbackAudio = this.fallbackPool[key]
    if (fallbackAudio) {
      fallbackAudio.pause()
      fallbackAudio.currentTime = 0
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null

    if (!this.audioContext) {
      const AudioContextCtor = window.AudioContext || (window as WebAudioWindow).webkitAudioContext
      if (!AudioContextCtor) return null

      this.audioContext = new AudioContextCtor()
      this.masterGain = this.audioContext.createGain()
      this.masterGain.gain.value = 0.75
      this.masterGain.connect(this.audioContext.destination)
    }

    return this.audioContext
  }

  private createFallbackAudio(key: string, src: string): void {
    const audio = new Audio(src)
    audio.preload = 'auto'
    audio.volume = 0.75
    audio.load()
    this.fallbackPool[key] = audio
  }

  private loadAudioBuffer(key: string, src: string): void {
    if (this.audioBuffers[key] || this.loadingBuffers[key]) return

    const audioContext = this.getAudioContext()
    if (!audioContext) return

    this.loadingBuffers[key] = fetch(src)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
      .then((audioBuffer) => {
        this.audioBuffers[key] = audioBuffer
      })
      .catch((error) => {
        console.warn(`音效【${key}】解码失败，将使用普通 Audio 播放`, error)
      })
      .finally(() => {
        delete this.loadingBuffers[key]
      })
  }

  private primeOutput(): void {
    if (this.hasPrimedOutput || !this.audioContext || !this.masterGain) return

    this.hasPrimedOutput = true

    const silentBuffer = this.audioContext.createBuffer(1, 1, this.audioContext.sampleRate)
    const source = this.audioContext.createBufferSource()
    source.buffer = silentBuffer
    source.connect(this.masterGain)
    source.start(0)
  }

  private bindUnlockEvents(): void {
    if (typeof window === 'undefined' || this.unlockHandler) return

    this.unlockHandler = () => {
      this.unlock()
    }

    window.addEventListener('pointerdown', this.unlockHandler, { capture: true, passive: true })
    window.addEventListener('touchstart', this.unlockHandler, { capture: true, passive: true })
    window.addEventListener('keydown', this.unlockHandler, { capture: true })
  }

  private unbindUnlockEvents(): void {
    if (typeof window === 'undefined' || !this.unlockHandler) return

    window.removeEventListener('pointerdown', this.unlockHandler, true)
    window.removeEventListener('touchstart', this.unlockHandler, true)
    window.removeEventListener('keydown', this.unlockHandler, true)
    this.unlockHandler = null
  }

  private queuePlay(key: string, options: PlayOptions): void {
    this.pendingPlays = this.pendingPlays.filter((pendingPlay) => pendingPlay.key !== key)
    this.pendingPlays.push({
      key,
      options: { ...options }
    })
    this.bindUnlockEvents()
  }

  private flushPendingPlays(): void {
    if (!this.pendingPlays.length || this.isFlushingPendingPlays) return

    this.isFlushingPendingPlays = true
    const pendingPlays = this.pendingPlays
    this.pendingPlays = []

    pendingPlays.forEach(({ key, options }) => {
      this.play(key, options)
    })

    this.isFlushingPendingPlays = false
  }

  private shouldDeferPlayback(): boolean {
    if (this.hasUnlockedAudio || this.audioContext?.state === 'running') return false
    if (typeof navigator === 'undefined') return false

    return navigator.userActivation?.isActive === false
  }

  private isAutoplayBlockedError(error: unknown): boolean {
    return typeof error === 'object'
      && error !== null
      && 'name' in error
      && error.name === 'NotAllowedError'
  }
}

// 全局单例，Nuxt 插件里会挂到 $audio。
export const audioPlayer = new AudioPlayer()
