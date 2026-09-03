export class BaseResponseDto<T> {
  success!: boolean;
  requestId!: string;
  timestamp!: string;
  data!: T | null;
  message?: string;

  static success<T>(
    data: T,
    requestId: string,
    message?: string,
  ): BaseResponseDto<T> {
    return {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data,
      message,
    };
  }

  static error<T>(
    message: string,
    requestId: string,
    error?: { detail: string; solution: string; code?: string },
  ): BaseResponseDto<T> {
    return {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      data: null,
      message,
      ...(error && {
        error: {
          detail: error.detail,
          solution: error.solution,
          ...(error.code && { code: error.code }),
        },
      }),
    };
  }
}
