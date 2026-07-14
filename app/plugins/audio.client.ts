import { audioPlayer } from '~/utils/audioPlayer'

export default defineNuxtPlugin(() => {
  return {
    provide: {
      audio: audioPlayer
    }
  }
})