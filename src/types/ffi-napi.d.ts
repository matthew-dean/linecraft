declare module 'ffi-napi' {
  export interface Library {
    [key: string]: (...args: any[]) => any;
  }
  
  export function Library(
    path: string,
    functions: Record<string, [string, string[]]>
  ): Library;
}

