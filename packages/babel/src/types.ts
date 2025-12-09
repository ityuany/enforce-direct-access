export interface PluginOptions {
  /**
   * 要检查的对象路径数组
   * 例如：["process.env", "import.meta.env"]
   *
   * 必填，不提供默认值
   * 如果为空数组或未配置，插件不会执行任何检查
   */
  paths: string[];
}

/**
 * 诊断消息类型
 */
export type DiagnosticType =
  | 'optional-chaining'
  | 'destructuring-with-optional'
  | 'destructuring';
