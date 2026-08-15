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
in
{
  options.programs.pi-pack.enable = lib.mkEnableOption "pi-pack resources";

  config = lib.mkIf cfg.enable {
    home.packages = [ self.packages.${pkgs.stdenv.hostPlatform.system}.sediment ];

    home.file =
      resourceEntries ".pi/agent/extensions" (self + "/extensions") extensions
      // resourceEntries ".pi/agent/skills" (self + "/skills") skills
      // resourceEntries ".pi/agent/prompts" (self + "/prompts") prompts
      // resourceEntries ".pi/agent/themes" (self + "/themes") themes;
  };
}
