export interface ControlledErrorShape {
  code: string
  message: string
  retryable: boolean
  action?: string
}

export class ControlledError extends Error implements ControlledErrorShape {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly action?: string
  ) {
    super(message)
    this.name = 'ControlledError'
  }

  toJSON(): ControlledErrorShape {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      action: this.action
    }
  }
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(
      /(password|token|authorization|challenge(?:Response)?)\s*[=:]\s*[^\s,;]+/gi,
      '$1=<redacted>'
    )
    .replace(
      /https?:\/\/[^\s]+[?&](?:token|signature|x-amz-signature)=[^\s&]+/gi,
      '<signed-url-redacted>'
    )
}
