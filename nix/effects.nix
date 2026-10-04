# nixbot scheduled effects. The GitToken comes from nixbot at runtime (a
# github app installation token on github repos).
{ pkgs, nixbot }:
let
  inherit (nixbot.lib.effects { inherit pkgs; }) mkEffect;

  mkRepoEffect =
    name: updater:
    mkEffect {
      name = "effect-${name}";
      checkout = true;
      inputs = [ pkgs.nix ];
      secretsMap.git.type = "GitToken";
      effectScript = ''
        nix --extra-experimental-features 'nix-command flakes' \
          run github:fosskar/nixfiles#updater-effect -- ${updater}
      '';
    };
in
_args: {
  onSchedule.update-pkgs = {
    when = {
      hour = 1;
      minute = 0;
    };
    outputs.effects.update-pkgs = mkRepoEffect "update-pkgs" "packages";
  };

  onSchedule.update-flake-inputs = {
    when = {
      hour = 1;
      minute = 30;
    };
    outputs.effects.update-flake-inputs = mkRepoEffect "update-flake-inputs" "flake-inputs";
  };
}
