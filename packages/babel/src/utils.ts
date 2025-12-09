import type * as t from '@babel/types';
import type { NodePath } from '@babel/core';

/**
 * 解析路径字符串为数组
 * 例如：'process.env' -> ['process', 'env']
 */
export function parsePath(path: string): string[] {
  return path.split('.');
}

/**
 * 检查标识符是否为全局引用
 * @param identifier 标识符节点
 * @param path 当前路径
 * @returns 是否为全局引用
 */
export function isGlobalReference(
  identifier: t.Identifier,
  path: NodePath<any>
): boolean {
  const binding = path.scope.getBinding(identifier.name);
  // 如果没有 binding，说明是全局引用
  // 如果有 binding，说明是局部变量
  return !binding;
}

/**
 * 构建表达式的完整路径
 * 例如：process.env.API_KEY -> { path: 'process.env.API_KEY', baseIdentifier: Identifier }
 */
export function buildExpressionPath(node: t.Expression): {
  path: string;
  baseIdentifier: t.Identifier | null;
} | null {
  const parts: string[] = [];
  let baseIdentifier: t.Identifier | null = null;

  let current: t.Expression | t.PrivateName = node;

  while (current) {
    if (current.type === 'MemberExpression') {
      // 静态成员访问：obj.prop
      if (current.property.type === 'Identifier' && !current.computed) {
        parts.unshift(current.property.name);
        current = current.object;
      }
      // 计算成员访问：obj['prop']
      else if (
        current.computed &&
        current.property.type === 'StringLiteral'
      ) {
        parts.unshift(current.property.value);
        current = current.object;
      } else {
        // 动态计算属性，无法确定路径
        return null;
      }
    } else if (current.type === 'Identifier') {
      parts.unshift(current.name);
      baseIdentifier = current;
      break;
    } else if (current.type === 'MetaProperty') {
      // import.meta - 这是特殊的，不需要作用域检查
      parts.unshift(current.property.name);
      parts.unshift(current.meta.name);
      break;
    } else if (current.type === 'OptionalMemberExpression') {
      // 可选链：obj?.prop 或 obj?.['prop']
      if (current.property.type === 'Identifier' && !current.computed) {
        parts.unshift(current.property.name);
        current = current.object;
      } else if (
        current.computed &&
        current.property.type === 'StringLiteral'
      ) {
        parts.unshift(current.property.value);
        current = current.object;
      } else {
        return null;
      }
    } else {
      // 其他类型的表达式，无法确定路径
      return null;
    }
  }

  if (parts.length === 0) {
    return null;
  }

  return {
    path: parts.join('.'),
    baseIdentifier,
  };
}

/**
 * 检查路径是否以某个前缀开始
 * 例如：'process.env.API_KEY' 以 'process.env' 开始
 */
export function pathStartsWith(fullPath: string, prefix: string): boolean {
  if (fullPath === prefix) {
    return true;
  }
  return fullPath.startsWith(prefix + '.');
}

/**
 * 检查表达式路径是否匹配配置的路径
 * @param exprPath 表达式构建的完整路径
 * @param configPaths 配置的路径集合
 * @returns 匹配的配置路径，如果不匹配返回 null
 */
export function matchConfigPath(
  exprPath: string,
  configPaths: Set<string>
): string | null {
  // 精确匹配
  if (configPaths.has(exprPath)) {
    return exprPath;
  }

  // 检查是否是某个配置路径的子路径
  for (const configPath of configPaths) {
    if (pathStartsWith(exprPath, configPath)) {
      return configPath;
    }
  }

  return null;
}

/**
 * 创建错误消息
 */
export function createErrorMessage(
  type: 'optional-chaining' | 'destructuring-with-optional' | 'destructuring',
  path: string
): string {
  switch (type) {
    case 'optional-chaining':
      return `Optional chaining with '${path}' is unsafe. Remove the optional chaining operator ('?.') and access properties directly instead.`;
    case 'destructuring-with-optional':
      return `Destructuring with optional chaining on '${path}' is unsafe. Remove both destructuring and optional chaining. Access properties directly from '${path}'.`;
    case 'destructuring':
      return `Destructuring '${path}' is unsafe. Access properties directly from '${path}' instead of destructuring.`;
  }
}
