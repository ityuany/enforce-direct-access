mod errors;
mod transform;

use swc_core::ecma::ast::Program;
use swc_core::ecma::visit::VisitMutWith;
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};
use transform::{EnforceDirectAccessTransformer, PluginConfig};

#[plugin_transform]
fn process_transform(mut program: Program, data: TransformPluginProgramMetadata) -> Program {
    // Handle None config by providing default empty config
    let config_str = data
        .get_transform_plugin_config()
        .unwrap_or_else(|| "{}".to_string());

    // Parse config, fallback to empty paths if invalid
    let config = serde_json::from_str::<PluginConfig>(&config_str)
        .unwrap_or_else(|_| PluginConfig { paths: vec![] });

    // Validate configuration (currently always returns Ok)
    let _ = config.validate();

    let mut transformer = EnforceDirectAccessTransformer::new(config);
    program.visit_mut_with(&mut transformer);

    program
}
