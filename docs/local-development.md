# Arranque local no IntelliJ

Seleciona **Main local** no seletor de Run/Debug. A configuração está em [.run/Main_local.run.xml](../.run/Main_local.run.xml). A configuração temporária antiga **Main** não é modificada.

Antes de cada arranque, Main local executa:

```text
resources:resources compiler:compile
```

Isto copia os recursos de `src/main/resources/` e compila Java para `target/classes/`. É necessário mesmo quando a IDE considera o projeto atualizado: o gate de QA pode ter feito `clean` e removido recursos da saída. Se a preparação falhar, corrige o erro Maven antes de arrancar; não uses uma opção que ignore erros de build.

Se a configuração não surgir, reabre o projeto. Para adaptar manualmente a configuração Main existente, acrescenta **Before launch → Run Maven Goal**, seleciona o `pom.xml` da raiz e indica os dois goals acima. Para usar também a base persistente, copia os argumentos de programa de Main local; copiar apenas os goals não muda o ambiente da configuração antiga.

## Ambiente e dados

- Backend em `127.0.0.1:8080`, perfil local.
- Base persistente da beta: `.factory-results/local-beta/data/beta.mv.db`.
- Uploads: `.factory-results/local-beta/uploads/`.
- Provisionamento de contas de teste desativado: contas já existentes mantêm-se; o arranque não redefine credenciais.
- Estas pastas contêm dados locais, não apenas logs: preserva-as quando limpares relatórios.
- Apenas uma instância pode ocupar a8080; uma segunda execução não substitui silenciosamente a anterior. Bases H2 em memória de outras configurações não são migradas automaticamente.

Não houve mudança dos valores de `application.properties`. Os argumentos da configuração local selecionam explicitamente o ambiente persistente.

## Alterações durante desenvolvimento

Depois de alterar Java ou configuração, volta a executar **Main local**. O projeto não usa DevTools; não há reinício automático enquanto o processo continua a correr.

O frontend Angular é separado, em `http://localhost:4200`; mantém o seu servidor de desenvolvimento ativo. Alterar a interface Angular não exige recompilar o frontend dentro do Main. Servir o frontend empacotado pela8080 é outro fluxo de build.

Referência: [tarefas Maven antes do arranque no IntelliJ](https://www.jetbrains.com/help/idea/work-with-maven-goals.html#run_maven_goal_before_run).
