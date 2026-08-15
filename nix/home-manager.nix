{
  self,
  extensions,
  skills,
  prompts,
  themes,
}:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.programs.pi-pack;

  resourceEntries =
    target: source: names:
    lib.listToAttrs (
      map (name: {
        name = "${target}/${name}";
        value.source = source + "/${name}";
      }) names
    );

  resourcePackages = {
    extensions.sediment-memory = [ cfg.package.sediment ];
    skills = { };
  };
in
{
  options.programs.pi-pack = {
    enable = lib.mkEnableOption "pi-pack resources";

    package = lib.mkOption {
      type = lib.types.attrsOf lib.types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system};
      description = "pi-pack package set for the current system";
    };

    extensions = lib.mkOption {
      type = lib.types.listOf (lib.types.enum extensions);
      default = extensions;
      description = "Extensions to deploy";
    };

    skills = lib.mkOption {
      type = lib.types.listOf (lib.types.enum skills);
      default = skills;
      description = "Skills to deploy";
    };
  };

  config = lib.mkIf cfg.enable {
    home.packages = lib.unique (
      lib.concatMap (name: resourcePackages.extensions.${name} or [ ]) cfg.extensions
      ++ lib.concatMap (name: resourcePackages.skills.${name} or [ ]) cfg.skills
    );

    home.file =
      resourceEntries ".pi/agent/extensions" (self + "/extensions") cfg.extensions
      // resourceEntries ".pi/agent/skills" (self + "/skills") cfg.skills
      // resourceEntries ".pi/agent/prompts" (self + "/prompts") prompts
      // resourceEntries ".pi/agent/themes" (self + "/themes") themes;
  };
}
