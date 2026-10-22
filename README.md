# Segmentos & Excel v2 — Power-Up para Trello

Dashboard para filtrar, identificar clientes sem segmento, editar segmentos **em lote** e exportar `.xlsx` com visual profissional.

## O que faz

- Marca etiquetas do quadro como **segmentos de clientes**. Somente elas aparecem na coluna **Segmento** do Excel.
- Filtra por **incluir / remover** etiquetas, ausência de todas, combinação, lista, texto e exclusões específicas.
- Mostra cards sem segmentação mesmo que tenham etiquetas não relacionadas, como `Pagou tudo`, `VIP` ou `Pendente`.
- Permite selecionar clientes individualmente, todos os resultados do filtro ou desmarcar.
- Aplica **um** segmento em lote, substituindo etiquetas de outros segmentos e **preservando integralmente** as etiquetas que não estão na configuração de segmentos.
- Lê etiquetas atuais antes de cada gravação; erros individuais são informados. Confirmação antes das alterações.
- Exporta Excel com abas `Clientes` e `Resumo do filtro`, título, filtros de coluna, cabeçalhos coloridos, listras alternadas, links e datas.
- Filtros privados por usuário/quadro.

**Importante:** As etiquetas selecionadas em **Etiquetas de segmento** funcionam como catálogo de segmentos e base dos filtros. Antes de trocar segmentos em lote, marque **todos os segmentos possíveis**, não somente o segmento de destino: se você esquecer um segmento antigo, o Power-Up irá preservá-lo como se fosse uma tag comum. Etiquetas financeiras e de status NÃO devem ser selecionadas nesse grupo. Para simplesmente remover cards com uma etiqueta de uma listagem, use `NÃO tem nenhuma` ou `Exceções / excluir`.

## Arquivos e função de cada um

| Arquivo | Função | Precisa editar? |
|---|---|---|
| `index.html` | Entrada / conector do Power-Up para o Trello | Não |
| `modal.html` | Janela principal e interface de segmentação | Não |
| `js/config.js` | **Chave pública** da API Trello e nome/autor do Power-Up | **Sim, uma vez** |
| `js/connector.js` | Adiciona o botão do Power-Up no quadro | Não |
| `js/modal.js` | Filtros, seleção, autenticação e edição dos cards via REST API | Não |
| `js/filter-engine.js` | Regras de filtragem, classificação e ordenação | Não |
| `js/batch-engine.js` | Preserva etiquetas não relacionadas e aplica só o segmento desejado | Não |
| `js/export-xlsx.js` | Gera o Excel estilizado via ExcelJS no navegador | Não |
| `css/styles.css` | Aparência do dashboard responsivo | Não |
| `assets/icon-light.svg` e `icon-dark.svg` | Ícones do botão | Não |
| `.github/workflows/deploy-pages.yml` | Publicação automática no GitHub Pages | Não |
| `.nojekyll` | Impede processamento Jekyll do site | Não |
| `.gitignore` | Ignora arquivos desnecessários | Não |
| `tests/*.test.js` | Testes automatizados da regra de filtro e segmento | Não |
| `LICENSE` | Licença do código | Não |

## Deploy sem programação no GitHub

1. Crie um repositório **público ou privado compatível com seu plano GitHub Pages** em https://github.com/new, por exemplo `trello-segmentos`.
2. Descompacte o ZIP. Suba **o conteúdo da pasta** `trello-segment-exporter` para a **raiz** do repositório (não coloque uma pasta extra contendo os arquivos). É fundamental enviar também a pasta oculta `.github`.
3. Em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions**.
4. No Trello, acesse https://trello.com/apps/admin e crie seu Power-Up; ative `Board Buttons`.
5. No Power-Up, procure a seção **Trello Auth** (ou **Authorization**) e gere/copie sua **API Key pública**. **Não copie o API Secret nem seu token.**
6. No GitHub, edite `js/config.js`: substitua `COLE_SUA_API_KEY_AQUI` pela **API Key pública** e opcionalmente ajuste nome/autor. Faça commit. A API Key é pública por definição; **jamais coloque o API Secret ou token nesse arquivo**.
7. Confira que o workflow `Deploy GitHub Pages` terminou com sucesso em **Actions**.
8. Sua URL será `https://SEU-USUARIO.github.io/trello-segmentos/index.html` (ajuste usuário e repositório). Abra a URL para confirmar a publicação.
9. No portal de Power-Ups, configure a **Iframe Connector URL** com essa URL. Se a configuração exigir **Allowed Origins**, informe `https://SEU-USUARIO.github.io` (somente o domínio, sem caminho). Salve e habilite o Power-Up no seu quadro.
10. No Trello, clique no botão **Segmentos & Excel**.

Os arquivos são um site estático. **Não precisa Node, backend, banco de dados nem hospedagem adicional.** Requer conexão à internet para carregar a biblioteca de Power-Ups e ExcelJS (CDN).

## Como usar

1. Marque em `Etiquetas de segmento` **todas** as etiquetas que representam segmentos profissionais (restaurante, advocacia, construção, etc.). Não marque `Pagou tudo`, `VIP`, `Pendente` etc.
2. Escolha o filtro `Tem pelo menos uma` para clientes classificados, ou `NÃO tem nenhuma` para **clientes ainda sem esses segmentos**, mesmo se tiverem tags financeiras.
3. Para excluir algum grupo do resultado, marque etiquetas em `Exceções / excluir`.
4. Escolha os clientes nas checkboxes da tabela, e em `Segmento para aplicar`, escolha o destino.
5. Clique `Autorizar edição` pela primeira vez e aprove a solicitação de acesso `read,write` na janela do Trello. A autorização é salva privadamente pelo Trello e pode precisar ser renovada após 30 dias.
6. Clique `Aplicar segmento aos selecionados`, revise a confirmação. O sistema consulta as etiquetas atuais, **retira as etiquetas do catálogo de segmentos** e atribui a etiqueta de destino; as demais tags continuam.
7. Para gerar a planilha estilizada, clique `Exportar Excel`. Exporta os cards **que estão no filtro atual**, não necessariamente apenas os selecionados para edição.

### Exemplo real

Cliente com `Restaurante`, `Pagou tudo` e `VIP` → selecione segmento `Construção` → card passará a ter `Construção`, `Pagou tudo` e `VIP`. Na planilha, a coluna Segmento ficará apenas `Construção`.

## Limitações e segurança

- A leitura pelo Power-Up cobre **cards abertos em listas abertas**. Não considera itens arquivados.
- O Power-Up opera **somente no quadro atual**, com os direitos do usuário autenticado. Se o usuário não puder editar um card, haverá falha nesse card.
- Para editar, exige uma API Key pública registrada no Power-Up e autorização Trello `read,write` via popup. **Não coloque tokens no código ou no GitHub.**
- A operação em lote não é transacional: se uma alteração falhar no meio, as anteriores permanecem feitas. Ao final são mostradas as falhas; os cards bem-sucedidos saem da seleção.
- Uma etiqueta sem nome será identificada pela cor. Dê nomes claros a todos os segmentos.
- Se as bibliotecas externas estiverem bloqueadas (por firewall/extensões), pode falhar o carregamento ou exportação.
- `js/config.js` é público no GitHub Pages. A API Key, diferentemente de um token, é pública e **não concede acesso sozinha**.
- Faça um teste em quadro com 2–3 cards antes da primeira operação em lote de produção.

## Testes locais (opcionais)

Com Node.js instalado, na pasta raiz: `node tests/filter-engine.test.js && node tests/batch-engine.test.js`.

**Referências:** https://developer.atlassian.com/cloud/trello/power-ups/rest-api-client/ · https://developer.atlassian.com/cloud/trello/rest/api-group-cards/ · https://developer.atlassian.com/cloud/trello/power-ups/client-library/accessing-trello-data/
