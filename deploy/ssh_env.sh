# Подключается из deploy.sh и sync_music.sh. В Windows-bash путь профиля с кириллицей («ВТБ»)
# иногда ломает чтение ~/.ssh/config («Could not resolve hostname myvps2») — даём ssh короткий путь 8.3.
SSHO=()
if command -v cygpath >/dev/null 2>&1; then
  _S=$(cygpath -d "$HOME" 2>/dev/null) && [ -n "$_S" ] && SSHO=(-F "$_S\.ssh\config" -o "UserKnownHostsFile=$_S\.ssh\known_hosts")
fi
ssh() { command ssh "${SSHO[@]}" "$@"; }
scp() { command scp "${SSHO[@]}" "$@"; }
