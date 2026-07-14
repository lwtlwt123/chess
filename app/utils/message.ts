import { h } from 'vue'
import { ElButton, ElMessage, ElMessageBox } from 'element-plus'

type ChessMessageType = 'success' | 'warning' | 'info' | 'error'

type ChessMessageOptions = {
  message: string
  type?: ChessMessageType
  duration?: number
  showClose?: boolean
}

type ChessConfirmOptions = {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
}

type ChessPromptOptions = ChessConfirmOptions & {
  inputValue?: string
  placeholder?: string
  inputPattern?: RegExp
  inputErrorMessage?: string
}

type ChessActionOption<T extends string = string> = {
  label: string
  value: T
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  disabled?: boolean
}

type ChessActionSelectOptions<T extends string = string> = {
  title?: string
  message?: string
  actions: ChessActionOption<T>[]
  cancelText?: string
}

export const showMessage = (options: string | ChessMessageOptions) => {
  if (!import.meta.client) return

  const messageOptions = typeof options === 'string'
    ? { message: options }
    : options

  const type = messageOptions.type ?? 'info'

  ElMessage({
    message: messageOptions.message,
    type,
    duration: messageOptions.duration ?? 2200,
    customClass: `chess-message chess-message--${type}`
  })
}

export const showChessSuccess = (message: string) => {
  showMessage({ message, type: 'success' })
}

export const showChessError = (message: string) => {
  showMessage({ message, type: 'error' })
}

export const showChessWarning = (message: string) => {
  showMessage({ message, type: 'warning' })
}

export const showChessInfo = (message: string) => {
  showMessage({ message, type: 'info' })
}

export const showChessConfirm = async (options: string | ChessConfirmOptions) => {
  if (!import.meta.client) return false

  const confirmOptions = typeof options === 'string'
    ? { message: options }
    : options

  try {
    await ElMessageBox.confirm(
      confirmOptions.message,
      confirmOptions.title ?? '棋局提示',
      {
        confirmButtonText: confirmOptions.confirmText ?? '确定',
        cancelButtonText: confirmOptions.cancelText ?? '取消',
        customClass: 'chess-confirm',
        closeOnClickModal: false,
        closeOnPressEscape: true,
        distinguishCancelAndClose: true,
        showClose: true,
        type: 'warning'
      }
    )

    return true
  } catch {
    return false
  }
}

export const showChessPrompt = async (options: string | ChessPromptOptions) => {
  if (!import.meta.client) return null

  const promptOptions = typeof options === 'string'
    ? { message: options }
    : options

  try {
    const result = await ElMessageBox.prompt(
      promptOptions.message,
      promptOptions.title ?? '棋局提示',
      {
        confirmButtonText: promptOptions.confirmText ?? '确定',
        cancelButtonText: promptOptions.cancelText ?? '取消',
        inputValue: promptOptions.inputValue ?? '',
        inputPlaceholder: promptOptions.placeholder,
        inputPattern: promptOptions.inputPattern,
        inputErrorMessage: promptOptions.inputErrorMessage,
        customClass: 'chess-confirm',
        closeOnClickModal: false,
        closeOnPressEscape: true,
        distinguishCancelAndClose: true,
        showClose: true
      }
    )

    return result.value.trim()
  } catch {
    return null
  }
}

export const showChessActionSelect = async <T extends string = string>(
  options: ChessActionSelectOptions<T>
) => {
  if (!import.meta.client) return null

  return new Promise<T | null>((resolve) => {
    let settled = false

    const finish = (value: T | null) => {
      if (settled) return

      settled = true
      resolve(value)
      ElMessageBox.close()
    }

    void ElMessageBox({
      title: options.title ?? '棋局提示',
      message: h('div', { class: 'chess-action-select' }, [
        options.message
          ? h('p', { class: 'chess-action-select__message' }, options.message)
          : null,
        h('div', { class: 'chess-action-select__buttons' }, options.actions.map((action, index) => {
          return h(
            ElButton,
            {
              type: action.type ?? (index === 0 ? 'primary' : undefined),
              disabled: action.disabled,
              onClick: () => finish(action.value)
            },
            () => action.label
          )
        }))
      ]),
      customClass: 'chess-confirm chess-action-box',
      showConfirmButton: false,
      showCancelButton: false,
      closeOnClickModal: false,
      closeOnPressEscape: true,
      distinguishCancelAndClose: true,
      showClose: true,
      beforeClose: (_action, _instance, done) => {
        if (!settled) {
          settled = true
          resolve(null)
        }

        done()
      }
    }).catch(() => {
      if (settled) return

      settled = true
      resolve(null)
    })
  })
}
