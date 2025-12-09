/// 错误报告工具模块
///
/// 提供统一的错误报告接口，使用 SWC 的 HANDLER 来生成漂亮的错误提示

use swc_core::common::{errors::HANDLER, Span};

/// 报告可选链错误
pub fn report_optional_chaining_error(path: &str, span: Span) {
    HANDLER.with(|handler| {
        handler
            .struct_span_err(
                span,
                &format!("Optional chaining with '{}' is unsafe", path),
            )
            .span_label(span, "remove the optional chaining operator ('?.')")
            .note(
                "Optional chaining prevents static analysis tools from correctly \
                identifying property accesses during build-time text replacement.",
            )
            .help(&format!(
                "Access properties directly from '{}' instead:\n\
                - ✗ Bad:  {}?.property\n\
                - ✓ Good: {}.property",
                path, path, path
            ))
            .emit();
    });
}

/// 报告解构 + 可选链错误
pub fn report_destructuring_with_optional_error(path: &str, span: Span) {
    HANDLER.with(|handler| {
        handler
            .struct_span_err(
                span,
                &format!(
                    "Destructuring with optional chaining on '{}' is unsafe",
                    path
                ),
            )
            .span_label(span, "remove both destructuring and optional chaining")
            .note(
                "The combination of destructuring and optional chaining makes it \
                impossible for static analysis tools to track property access patterns.",
            )
            .help(&format!(
                "Access properties directly from '{}' instead:\n\
                - ✗ Bad:  const {{ prop }} = {}?.object;\n\
                - ✓ Good: {}.object.prop",
                path, path, path
            ))
            .emit();
    });
}

/// 报告纯解构错误
pub fn report_destructuring_error(path: &str, span: Span) {
    HANDLER.with(|handler| {
        handler
            .struct_span_err(span, &format!("Destructuring '{}' is unsafe", path))
            .span_label(span, "remove destructuring pattern")
            .note(
                "Destructuring breaks the static property access chain that build-time \
                text replacement tools rely on.",
            )
            .help(&format!(
                "Access properties directly from '{}' instead:\n\
                - ✗ Bad:  const {{ prop }} = parent;\n\
                - ✓ Good: {}.prop",
                path, path
            ))
            .emit();
    });
}
