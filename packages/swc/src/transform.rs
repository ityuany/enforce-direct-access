use crate::errors::{
    report_destructuring_error, report_destructuring_with_optional_error,
    report_optional_chaining_error,
};
use serde::Deserialize;
use std::collections::HashSet;
use swc_core::common::Span;
use swc_core::ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
};

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginConfig {
    /// 要检查的对象路径数组
    /// 例如：["process.env", "import.meta.env"]
    pub paths: Vec<String>,
}

impl PluginConfig {
    pub fn validate(&self) -> Result<(), String> {
        // 配置验证：paths 不能为空
        if self.paths.is_empty() {
            return Err("'paths' cannot be empty. Please provide at least one path to check.".to_string());
        }

        Ok(())
    }
}

pub struct EnforceDirectAccessTransformer {
    config_paths: HashSet<String>,
}

impl EnforceDirectAccessTransformer {
    pub fn new(config: PluginConfig) -> Self {
        Self {
            config_paths: config.paths.into_iter().collect(),
        }
    }

    /// 构建表达式的完整路径
    /// 返回 (path, is_optional_chaining)
    fn build_expression_path(&self, expr: &Expr) -> Option<(String, bool)> {
        let mut parts = Vec::new();
        let mut current = expr;
        let mut has_optional = false;

        loop {
            match current {
                // 普通成员访问：obj.prop
                Expr::Member(member) => {
                    if let MemberProp::Ident(ident) = &member.prop {
                        parts.insert(0, ident.sym.to_string());
                        current = &member.obj;
                    } else if let MemberProp::Computed(computed) = &member.prop {
                        // 计算属性：obj['prop']
                        // Note: We currently don't support computed properties
                        // This could be enhanced in the future
                        return None;
                    } else {
                        return None;
                    }
                }

                // 可选链成员访问：obj?.prop
                Expr::OptChain(opt_chain) => {
                    has_optional = true;
                    if let OptChainBase::Member(member) = &*opt_chain.base {
                        if let MemberProp::Ident(ident) = &member.prop {
                            parts.insert(0, ident.sym.to_string());
                            current = &member.obj;
                        } else if let MemberProp::Computed(_computed) = &member.prop {
                            // Currently don't support computed properties
                            return None;
                        } else {
                            return None;
                        }
                    } else {
                        // 可选链调用表达式，不处理
                        return None;
                    }
                }

                // 标识符：process
                Expr::Ident(ident) => {
                    parts.insert(0, ident.sym.to_string());
                    break;
                }

                // import.meta
                Expr::MetaProp(meta) => {
                    // MetaPropExpr 只有 kind 字段，表示 import.meta 或 new.target
                    // 对于 import.meta.env，我们需要特殊处理
                    match meta.kind {
                        MetaPropKind::ImportMeta => {
                            parts.insert(0, "meta".to_string());
                            parts.insert(0, "import".to_string());
                        }
                        MetaPropKind::NewTarget => {
                            parts.insert(0, "target".to_string());
                            parts.insert(0, "new".to_string());
                        }
                    }
                    break;
                }

                _ => return None,
            }
        }

        if parts.is_empty() {
            return None;
        }

        Some((parts.join("."), has_optional))
    }

    /// 检查路径是否以某个前缀开始
    fn path_starts_with(&self, full_path: &str, prefix: &str) -> bool {
        if full_path == prefix {
            return true;
        }
        full_path.starts_with(&format!("{}.", prefix))
    }

    /// 检查表达式路径是否匹配配置的路径
    fn match_config_path(&self, expr_path: &str) -> Option<String> {
        // 精确匹配
        if self.config_paths.contains(expr_path) {
            return Some(expr_path.to_string());
        }

        // 检查是否是某个配置路径的子路径
        for config_path in &self.config_paths {
            if self.path_starts_with(expr_path, config_path) {
                return Some(config_path.clone());
            }
        }

        None
    }

    /// 处理可选链表达式
    fn handle_optional_chain_expr(&self, expr: &Expr, span: Span) {
        if let Some((expr_path, has_optional)) = self.build_expression_path(expr) {
            if has_optional {
                if let Some(matched_path) = self.match_config_path(&expr_path) {
                    report_optional_chaining_error(&matched_path, span);
                }
            }
        }
    }

    /// 处理解构模式
    fn handle_destructuring(&self, pat: &Pat, init: &Expr, span: Span) {
        // 只处理对象解构
        if let Pat::Object(object_pat) = pat {
            // 构建 init 表达式的路径
            if let Some((init_path, has_optional)) = self.build_expression_path(init) {
                // Pattern 2: 如果 init 使用了可选链，检查 init 路径本身是否匹配
                if has_optional && self.config_paths.contains(&init_path) {
                    report_destructuring_with_optional_error(&init_path, span);
                    return;
                }

                // Pattern 3: 检查 init + 属性名的组合是否匹配配置路径
                for prop in &object_pat.props {
                    if let ObjectPatProp::KeyValue(kv) = prop {
                        // 获取属性名
                        let property_name = match &kv.key {
                            PropName::Ident(ident) => Some(ident.sym.to_string()),
                            // Currently don't support string literal keys due to Wtf8 complexity
                            _ => None,
                        };

                        if let Some(property_name) = property_name {
                            // 组合完整路径：init 路径 + 属性名
                            let full_path = format!("{}.{}", init_path, property_name);

                            // 检查是否匹配配置的路径
                            if self.config_paths.contains(&full_path) {
                                // Pattern 3: 纯解构（init 不含可选链）
                                if !has_optional {
                                    report_destructuring_error(&full_path, span);
                                }
                            }
                        }
                    } else if let ObjectPatProp::Assign(assign) = prop {
                        // 简写形式：const { env } = process
                        let property_name = assign.key.sym.to_string();
                        let full_path = format!("{}.{}", init_path, property_name);

                        if self.config_paths.contains(&full_path) {
                            if !has_optional {
                                report_destructuring_error(&full_path, span);
                            }
                        }
                    }
                }
            }
        }
    }
}

impl VisitMut for EnforceDirectAccessTransformer {
    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        // 检测可选链（OptChain）
        if let Expr::OptChain(opt_chain) = expr {
            let span = opt_chain.span;
            self.handle_optional_chain_expr(expr, span);
        }

        // 继续访问子节点
        expr.visit_mut_children_with(self);
    }

    fn visit_mut_var_declarator(&mut self, declarator: &mut VarDeclarator) {
        // 检测解构模式
        if let Pat::Object(_) = &declarator.name {
            if let Some(init) = &declarator.init {
                self.handle_destructuring(&declarator.name, init, declarator.span);
            }
        }

        // 继续访问子节点
        declarator.visit_mut_children_with(self);
    }
}
