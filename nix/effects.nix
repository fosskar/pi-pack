# nixbot scheduled effects. The GitToken comes from nixbot at runtime (a
# github app installation token on github repos).
{ pkgs }:
_args: {
  onSchedule.update-flake-inputs = {
    when = {
      hour = 6;
      minute = 0;
    };
    outputs.effects.update-flake-inputs =
      pkgs.runCommand "effect-update-flake-inputs"
        {
          nativeBuildInputs = [
            pkgs.cacert
            pkgs.git
            pkgs.jq
            pkgs.nix
          ];
          # The GitToken is a github app installation token, so it serves the
          # direct github API calls too.
          secretsMap = builtins.toJSON { git.type = "GitToken"; };
          HOME = "/build";
        }
        ''
          set -euo pipefail
          token=$(jq -re '.git.data.token' "$HERCULES_CI_SECRETS_JSON")
          export FORGE_TOKEN="$token"
          export GITHUB_TOKEN="$token"
          export NIX_CONFIG="experimental-features = nix-command flakes
          access-tokens = github.com=$token"

          git config --global user.name 'fosskar[bot]'
          git config --global user.email '300917551+fosskar[bot]@users.noreply.github.com'
          git config --global safe.directory '*'

          git clone --depth 1 --progress \
            "https://oauth2:$token@github.com/fosskar/pi-pack.git" repo
          cd repo

          nix run "github:fosskar/nixfiles#updater-flake-inputs"
        '';
  };
}
