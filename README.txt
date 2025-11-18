GZS Manager - Sistema de Controle e Gestão

Como usar:
1) Extraia esta pasta para sua Área de Trabalho.
2) Abra o arquivo index.html no Google Chrome (ou Edge).
3) Login: usuario = gelozonasul   senha = 1234
4) Painel -> abra funcionário -> registre Entradas, Saída almoço, Volta almoço (dias 1..31)
5) Para pagamento Semanal: clique em "Escolher Período Semanal" e selecione início e fim (fim precisa ser domingo).
6) Para pagamento Quinzenal: clique em "Escolher Período Quinzenal" e selecione início e fim.
7) Clique "Gerar Relatório" para abrir o relatório e imprimir/salvar como PDF.

Backup:
- Em Configurações -> Exportar backup (gera arquivo .json)
- Para restaurar, abra Console (F12) e cole:
  localStorage.setItem('gzs_manager_v3', `PASTE_JSON_HERE`);
  location.reload();

Observações:
- Alimentação acumulada só é somada quando o funcionário tem modo "Acumulada".
- Venda de folga só é somada se em modo "Acumulada".
- Atraso contado a partir de 08:21 (>= 08:21).
- Relatórios são baixados como arquivo .html imprimível; para gerar PDF use Imprimir -> Salvar como PDF.
