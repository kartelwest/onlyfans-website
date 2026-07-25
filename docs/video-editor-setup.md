# Guia passo a passo — Editor de Vídeo automatizado

Este guia configura o editor de vídeo do KarayModels pela primeira vez.

## 1. Rodar a migration no Supabase

1. Acesse o dashboard do seu projeto Supabase.
2. Vá em **SQL Editor > New query**.
3. Cole o conteúdo do arquivo `supabase/migrations/20260725190000_video_editor_schema.sql`.
4. Clique em **Run**.

Isso cria todas as tabelas, funções, políticas RLS e os buckets `video-originals` e `video-edited`.

## 2. Verificar/criar os buckets de storage

A migration já tenta inserir os buckets. Confirme no Supabase:

1. Vá em **Storage > Buckets**.
2. Verifique se existem:
   - `video-originals` (private)
   - `video-edited` (private)
3. Se não existirem, crie manualmente como **Private** e aplique as políticas do final da migration.

## 3. Adicionar variáveis de ambiente no Vercel

No projeto Vercel, vá em **Settings > Environment Variables** e adicione:

```bash
SUPABASE_VIDEO_ORIGINAIS_BUCKET=video-originals
SUPABASE_VIDEO_EDITADOS_BUCKET=video-edited
VIDEO_WORKER_API_KEY=                # pode deixar vazio no MVP
VIDEO_MAX_FILE_SIZE_MB=2048
VIDEO_MAX_DURATION_SECONDS=600
VIDEO_WORKER_CONCURRENCY=2
VIDEO_WORKER_POLL_INTERVAL_MS=15000

GOOGLE_CLOUD_PROJECT=                # preencher na hora do deploy
GOOGLE_CLOUD_REGION=southamerica-east1
GOOGLE_CLOUD_ARTIFACT_REPO=karay-video-worker
CLOUD_RUN_SERVICE_NAME=karay-video-worker
```

As demais (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) já devem existir.

## 4. Criar um projeto Google Cloud para o worker

1. Acesse https://console.cloud.google.com/projectcreate
2. Nomeie como preferir (ex: `karay-models-worker`).
3. Anote o **Project ID** (não o nome).
4. Vincule uma conta de faturamento.

## 5. Criar service account e chave JSON

1. No projeto criado, vá em **IAM & Admin > Service Accounts**.
2. Clique em **Create service account**.
3. Nome: `karay-video-worker`.
4. Em **Grant roles**, adicione:
   - `Cloud Run Admin`
   - `Cloud Build Service Account`
   - `Artifact Registry Administrator`
   - `Viewer` (ou `Service Account User`)
5. Crie a conta e vá em **Keys > Add key > JSON**.
6. Baixe o arquivo `.json`.

## 6. Fazer deploy do worker no Cloud Run

1. Copie o conteúdo do arquivo `.json` baixado.
2. No terminal local (ou na Devin), defina as variáveis:

```bash
export GOOGLE_CLOUD_PROJECT=SEU_PROJECT_ID
export GOOGLE_CLOUD_REGION=southamerica-east1
export GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY=$(cat caminho/para/key.json)
```

3. Rode o script:

```bash
cd worker
./deploy-cloud-run.sh
```

O script habilita as APIs necessárias, faz o build, envia a imagem para o Artifact Registry e deploya o serviço `karay-video-worker`.

## 7. Testar o upload e renderização

1. Abra o admin em `/admin/editor-de-video`.
2. Clique em **Criar templates padrão** (apenas na primeira vez).
3. Selecione uma modelo, um template (ex: `Instagram Reels — Básico`) e faça upload de um vídeo.
4. O job aparecerá na tabela como `pending`.
5. Clique em **Aprovar**.
6. O worker Cloud Run deverá processar o vídeo e atualizar o status para `completed`.
7. Use o botão **Visualizar** para ver o vídeo editado via URL assinada.

## Próxima etapa (por modelo)

Quando você abrir o perfil de uma modelo no admin e clicar na aba **Vídeo**, aparecerá automaticamente um checklist com 3 itens:

1. Criar conta Google individual da modelo.
2. Compartilhar pastas do Google Drive com a agência.
3. Definir template padrão e plataforma.

Marque cada item conforme for concluído.
