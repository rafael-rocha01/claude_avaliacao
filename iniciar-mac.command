#!/bin/bash
# Dois cliques para iniciar (na 1ª vez: botão direito > Abrir, para o macOS liberar).
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python não encontrado. Instale em python.org/downloads e abra este arquivo de novo."
  open "https://www.python.org/downloads/"
  read -r -p "Enter para sair"
  exit 1
fi
echo
echo "============ Avaliação Física ============"
echo
echo "  1 - Usar só no notebook"
echo "  2 - Notebook + celular no mesmo Wi-Fi (fotos com câmera guiada)"
echo
read -r -p "  Digite 1 ou 2 e aperte Enter: " OP
echo
if [ "$OP" = "2" ]; then
  echo "Na primeira vez o navegador avisa que o certificado não é confiável:"
  echo "clique em Mostrar detalhes > visitar este site. Ele foi gerado neste computador."
  echo
  python3 servidor.py --rede --https --abrir
else
  python3 servidor.py --abrir
fi
