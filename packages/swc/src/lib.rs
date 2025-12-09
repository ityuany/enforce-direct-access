mod errors;
mod transform;

use swc_core::ecma::ast::Program;
use swc_core::ecma::visit::VisitMutWith;
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};
use transform::{EnforceDirectAccessTransformer, PluginConfig};

#[plugin_transform]
fn process_transform(mut program: Program, data: TransformPluginProgramMetadata) -> Program {
    let config = serde_json::from_str::<PluginConfig>(
        &data
            .get_transform_plugin_config()
            .expect("failed to get plugin config"),
    )
    .expect("invalid config for swc-plugin-enforce-direct-access");

    // 验证配置
    config
        .validate()
        .expect("invalid plugin configuration");

    let mut transformer = EnforceDirectAccessTransformer::new(config);
    program.visit_mut_with(&mut transformer);

    program
}
