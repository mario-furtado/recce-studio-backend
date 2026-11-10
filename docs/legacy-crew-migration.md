# Migração do legado — UAC-P03 / FEAT-020

Implementação inicial para **H2 em ficheiro e media local**, com operação explícita e offline. Não existe endpoint de migração nem conversão automática de equipas no arranque. Nesta entrega, apenas dados sintéticos foram convertidos. O rollout geral de novas tripulações continua desativado por omissão.

## Quem pode ser convertido

D02 foi aprovada para o processo: manifesto por IDs de equipa e conta, sem inferir proprietário. A ferramenta aceita uma equipa com uma única conta ligada e ativa, explicitamente indicada como proprietário. Membros adicionais, dono ausente/inativo, inventário divergente e ficheiros ou vínculos ambíguos bloqueiam esse contexto. Não se muda o acesso legado dos contextos recusados nem se criam permissões READ. Atribuições concretas sobre dados reais exigem aprovação própria.

D11 aplica-se às crews novas; para o legado convertido o ID do perfil existente é reutilizado como ID da crew. Ralis, PECs, notas, capas, imagens, viaturas, recibos e configurações pessoais mantêm IDs, referências e conteúdo. Não há cópia de projetos, alteração de caminhos de media ou migração IndexedDB.

## Ensaio isolado

Usa Maven, Java e Node configurados no PATH. Indica o caminho base de um ficheiro H2 `.mv.db` existente **sem extensão**, a raiz de media e novos destinos. A base não pode estar aberta por outra instância. Não são aceites parâmetros JDBC na entrada. Define `RECCE_MIGRATION_DB_USER` e `RECCE_MIGRATION_DB_PASSWORD` no ambiente se diferirem de `sa` e password vazia.

Os exemplos seguintes são para **uma cópia de ensaio**, não para a beta. Cria primeiro o diretório de trabalho dos relatórios; `backup` e `restore-check` exigem subdiretórios novos.

```powershell
node tools/run-legacy-crew-migration.mjs plan --database $db --media $media --out $plan
node tools/run-legacy-crew-migration.mjs backup --database $db --media $media --out $backup
node tools/run-legacy-crew-migration.mjs restore-check --backup $backup --out $restore
```

O plano lista candidatos por ID, bloqueios, contagens e checksums; não sugere owner. Órfãos são identificados e preservados. Backup contém SQL, media e descriptor de integridade. Restauro ensaiado recria uma nova base e cópias de media, compara os registos, bytes e inventários e cria `restore-proof.json`. Referências absolutas são verificadas em relação à raiz original; um restauro operacional deve preservar essa raiz. Não se muda o storage key para apontar a outro local.

O backup SQL inclui dados de autenticação. Mantém backup, restauro, manifesto e relatórios protegidos e fora do Git. `restore-check` executa SQL: usa apenas backups de origem confiável produzidos para a operação. O checksum confirma integridade, não autentica uma origem desconhecida.

## Manifesto e retoma

Preparar o documento revisto a partir dos IDs e digest do plano, com uma entrada por contexto aprovado. Exemplo sintético:

```json
{
  "version": 1,
  "approvedBy": "responsavel-do-ensaio",
  "approvalReference": "decisao-registada",
  "entries": [{
    "teamProfileId": "legacy-a",
    "ownerAccountId": "user-a",
    "legacyAccountIds": ["user-a"],
    "expectedDigest": "<sha256 do contexto no plano>"
  }]
}
```

Depois da revisão, confirmar o SHA-256 do ficheiro exato e executar apenas contra o alvo isolado aprovado:

```powershell
$approvedDigest = (Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash.ToLowerInvariant()
node tools/run-legacy-crew-migration.mjs apply --database $db --media $media --manifest $manifest --approved-sha256 $approvedDigest --backup $backup --restore-proof $proof --batch-size 1 --out $report
```

`$proof` é o caminho de `restore-proof.json` no diretório restaurado. A ferramenta reabre a base restaurada e reconcilia os ficheiros; a prova JSON isolada não é suficiente. O inventário do manifesto tem de existir no backup e corresponder ao contexto corrente. A aprovação é operacional, registada pelo operador; não se trata de assinatura digital.

Cada contexto é confirmado numa transação e registado no journal com dono, digest do manifesto, inventário e backup, e referência de aprovação. Uma falha não desfaz contextos anteriormente confirmados; o contexto em falha não fica parcialmente convertido. Para retomar, conserva exatamente o manifesto e backup originais, corrige o motivo de recusa e indica um novo relatório. `ALREADY_APPLIED` não reescreve dados; `PENDING` permanece por executar. Alterar dono requer outra feature, não repetir esta operação com outro manifesto.

## Autorização e rollback

O adaptador antigo continua a usar os mesmos URLs. Em contexto convertido, resolve a propriedade pelo journal e ID da conta, incluindo com `RECCE_CREWS_ENABLED=false`. O campo antigo da conta é retirado; constraints impedem repor esse vínculo ou ligar uma nova conta legada ao contexto convertido. O bootstrap do utilizador de testes deve ficar desativado após cutover. O backfill automático antigo já não reatribui órfãos depois de haver uma conversão.

Antes de arrancar um artefacto de rollback, com a base offline:

```powershell
node tools/run-legacy-crew-migration.mjs check-rollback --database $db --jar $jar
```

Com dados do novo modelo, a ferramenta recusa artefactos sem `Recce-Authorization: crew-compat-v1`. Usar apenas builds confiáveis e aprovados; o marcador é um contrato de compatibilidade, não uma assinatura nem uma proteção contra execução manual de binários ou SQL privilegiado. Um rollback compatível conserva a base atual, journal e constraints e pode desligar a UI nova. Não recupera tokens revogados nem restaura acesso pelo vínculo antigo. Restaurar uma base inteira anterior é recuperação de desastre, não rollback de rotina: perderia escritas posteriores.

## Limites

Sem migração/arranque da beta, PostgreSQL, S3, relocalização de media ou ensaio de volume de produção. O inventário e backup são síncronos e destinam-se a ensaios controlados. Validar backups, capacidade e restauro representativo no ambiente alvo antes de qualquer cutover real. Não se anteciparam P04 ou P09.

Resultados: [FEAT-020](features/FEAT-020-migracao-legado-compatibilidade.md).
