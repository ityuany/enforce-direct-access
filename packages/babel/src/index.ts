import type { PluginObj, NodePath } from '@babel/core';
import type * as t from '@babel/types';
import type { PluginOptions } from './types';
import {
  buildExpressionPath,
  matchConfigPath,
  createErrorMessage,
  isGlobalReference,
} from './utils';

export default function enforceDirectAccessPlugin(): PluginObj {
  return {
    name: 'babel-plugin-enforce-direct-access',

    visitor: {
      // 检测可选链（OptionalMemberExpression）
      OptionalMemberExpression(
        path: NodePath<t.OptionalMemberExpression>,
        state: any
      ) {
        const options = state.opts as PluginOptions | undefined;

        // 如果没有配置或 paths 为空，不执行检查
        if (!options || !options.paths || options.paths.length === 0) {
          return;
        }

        const configPaths = new Set(options.paths);

        // 检查父节点是否为 VariableDeclarator 的 init，且左侧是解构
        // 如果是，跳过这里的检查，让 VariableDeclarator 处理
        const parent = path.parentPath;
        if (
          parent.isVariableDeclarator() &&
          parent.node.id.type === 'ObjectPattern'
        ) {
          return;
        }

        // 构建完整路径（忽略可选链操作符）
        const result = buildExpressionPath(path.node);
        if (!result) {
          return;
        }

        const { path: exprPath, baseIdentifier } = result;

        // 如果有基础标识符，检查是否为全局引用
        // 如果是局部变量，跳过检查
        if (baseIdentifier && !isGlobalReference(baseIdentifier, path)) {
          return;
        }

        // 检查是否匹配配置的路径
        const matchedPath = matchConfigPath(exprPath, configPaths);
        if (matchedPath) {
          throw path.buildCodeFrameError(
            createErrorMessage('optional-chaining', matchedPath)
          );
        }
      },

      // 检测解构模式
      VariableDeclarator(path: NodePath<t.VariableDeclarator>, state: any) {
        const options = state.opts as PluginOptions | undefined;

        // 如果没有配置或 paths 为空，不执行检查
        if (!options || !options.paths || options.paths.length === 0) {
          return;
        }

        // 只检查对象解构
        if (path.node.id.type !== 'ObjectPattern') {
          return;
        }

        // 必须有初始值
        if (!path.node.init) {
          return;
        }

        const configPaths = new Set(options.paths);
        const init = path.node.init;

        // 检查 init 是否包含可选链
        const hasOptionalChaining =
          init.type === 'OptionalMemberExpression' ||
          init.type === 'OptionalCallExpression';

        // 构建 init 表达式的路径
        const result = buildExpressionPath(init);
        if (!result) {
          return;
        }

        const { path: initPath, baseIdentifier } = result;

        // 如果有基础标识符，检查是否为全局引用
        // 如果是局部变量，跳过检查
        if (baseIdentifier && !isGlobalReference(baseIdentifier, path)) {
          return;
        }

        // Pattern 2: 如果 init 使用了可选链，检查 init 路径本身是否匹配
        if (hasOptionalChaining && configPaths.has(initPath)) {
          throw path.buildCodeFrameError(
            createErrorMessage('destructuring-with-optional', initPath)
          );
        }

        // Pattern 3: 检查 init + 属性名的组合是否匹配配置路径
        const objectPattern = path.node.id;
        for (const property of objectPattern.properties) {
          // 只处理普通属性，不处理 rest 元素
          if (property.type !== 'ObjectProperty') {
            continue;
          }

          // 获取属性名
          let propertyName: string | null = null;
          if (property.key.type === 'Identifier' && !property.computed) {
            propertyName = property.key.name;
          } else if (
            property.computed &&
            property.key.type === 'StringLiteral'
          ) {
            propertyName = property.key.value;
          }

          if (!propertyName) {
            continue;
          }

          // 组合完整路径：init 路径 + 属性名
          const fullPath = `${initPath}.${propertyName}`;

          // 检查是否匹配配置的路径
          if (configPaths.has(fullPath)) {
            // Pattern 3: 纯解构（init 不含可选链）
            if (!hasOptionalChaining) {
              throw path.buildCodeFrameError(
                createErrorMessage('destructuring', fullPath)
              );
            }
          }
        }
      },
    },
  };
}

export type { PluginOptions } from './types';
