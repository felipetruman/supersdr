#!/usr/bin/env bash
# Rename: evolution -> evolution-baileys
# Roda em bash explicito para ignorar aliases do zsh (find->fd, grep->rg)
set -euo pipefail

if [ ! -d "src/adapters/evolution" ]; then
  echo "ERRO: src/adapters/evolution nao encontrado. Rode na raiz do projeto."
  exit 1
fi

echo ">>> Fase 1: rename evolution -> evolution-baileys"
echo ""

# ============================================
# 1. Move diretorios
# ============================================
echo "[1/4] Movendo diretorios..."
git mv src/adapters/evolution src/adapters/evolution-baileys
git mv src/tests/providers/evolution src/tests/providers/evolution-baileys

# ============================================
# 2. Renomeia arquivos
# ============================================
echo "[2/4] Renomeando arquivos..."

cd src/adapters/evolution-baileys
git mv evolution.client.ts   evolution-baileys.client.ts
git mv evolution.parser.ts   evolution-baileys.parser.ts
git mv evolution.provider.ts evolution-baileys.provider.ts
git mv evolution.schemas.ts  evolution-baileys.schemas.ts
cd - > /dev/null

cd src/tests/providers/evolution-baileys
git mv evolution.client.test.ts         evolution-baileys.client.test.ts
git mv evolution.parser.test.ts         evolution-baileys.parser.test.ts
git mv evolution.parser.extra.test.ts   evolution-baileys.parser.extra.test.ts
git mv evolution.provider.test.ts       evolution-baileys.provider.test.ts
git mv evolution.provider.extra.test.ts evolution-baileys.provider.extra.test.ts
cd - > /dev/null

# ============================================
# 3. Substitui referencias (usa # como delimitador do sed)
# ============================================
echo "[3/4] Atualizando referencias internas..."

# Detecta sed BSD (macOS) vs GNU (Linux)
if sed --version >/dev/null 2>&1; then
  SED_INPLACE=(-i)
else
  SED_INPLACE=(-i "")
fi

# Lista de arquivos .ts (find POSIX, ignorando alias fd)
FILES=$(/usr/bin/find src -type f -name "*.ts")

for f in $FILES; do
  # 3.1 Imports relativos: ./evolution.X.js -> ./evolution-baileys.X.js
  sed "${SED_INPLACE[@]}" \
    -e "s#'\./evolution\.client\.js'#'./evolution-baileys.client.js'#g" \
    -e "s#'\./evolution\.parser\.js'#'./evolution-baileys.parser.js'#g" \
    -e "s#'\./evolution\.provider\.js'#'./evolution-baileys.provider.js'#g" \
    -e "s#'\./evolution\.schemas\.js'#'./evolution-baileys.schemas.js'#g" \
    "$f"

  # 3.2 Imports dos testes
  sed "${SED_INPLACE[@]}" \
    -e "s#adapters/evolution/evolution\.client\.js#adapters/evolution-baileys/evolution-baileys.client.js#g" \
    -e "s#adapters/evolution/evolution\.parser\.js#adapters/evolution-baileys/evolution-baileys.parser.js#g" \
    -e "s#adapters/evolution/evolution\.provider\.js#adapters/evolution-baileys/evolution-baileys.provider.js#g" \
    -e "s#adapters/evolution/evolution\.schemas\.js#adapters/evolution-baileys/evolution-baileys.schemas.js#g" \
    "$f"

  # 3.3 String literal 'evolution' em contextos especificos
  sed "${SED_INPLACE[@]}" \
    -e "s#provider: 'evolution'#provider: 'evolution-baileys'#g" \
    -e "s#ProviderApiError(\s*'evolution'#ProviderApiError('evolution-baileys'#g" \
    -e "s#WebhookSignatureError('evolution')#WebhookSignatureError('evolution-baileys')#g" \
    -e "s#WebhookValidationError('evolution',#WebhookValidationError('evolution-baileys',#g" \
    -e "s#: ProviderName = 'evolution'#: ProviderName = 'evolution-baileys'#g" \
    "$f"
done

# 3.4 ProviderName union em core/types/message.ts (linha especifica, delimitador #)
sed "${SED_INPLACE[@]}" \
  "s#'meta' | 'evolution' | 'wppconnect' | 'zapi'#'meta' | 'evolution-baileys' | 'wppconnect' | 'zapi'#g" \
  src/core/types/message.ts

# ============================================
# 4. Validacao
# ============================================
echo "[4/4] Validando..."

# /usr/bin/grep para ignorar alias rg
LEFTOVER=$(/usr/bin/grep -rn "'evolution'" src --include="*.ts" 2>/dev/null || true)
if [ -n "$LEFTOVER" ]; then
  echo ""
  echo "AVISO: ainda ha referencias a 'evolution' (sem -baileys):"
  echo "$LEFTOVER"
fi

OLD_IMPORTS=$(/usr/bin/grep -rn "evolution/evolution\." src --include="*.ts" 2>/dev/null || true)
if [ -n "$OLD_IMPORTS" ]; then
  echo ""
  echo "ERRO: imports antigos detectados:"
  echo "$OLD_IMPORTS"
  exit 1
fi

echo ""
echo "==> Fase 1 concluida!"
echo ""
echo "Proximos passos:"
echo "  1. npm run typecheck"
echo "  2. npm test"
echo "  3. git status"
