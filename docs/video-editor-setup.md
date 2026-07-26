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
VIDEO_WORKER_API_KEY=                # string aleatória segura
VIDEO_MAX_FILE_SIZE_MB=2048
VIDEO_MAX_DURATION_SECONDS=600
VIDEO_WORKER_CONCURRENCY=2
VIDEO_WORKER_POLL_INTERVAL_MS=15000
```

As demais (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`) já devem existir.

## 4. Criar uma VM Always Free no Oracle Cloud Infrastructure (OCI)

A worker é executada em uma instância **ARM/Ampere A1** do OCI, que é gratuita para sempre e tem 2 OCPUs + 12 GB de RAM (o suficiente para renderizar vídeos).

1. Crie uma conta em https://www.oracle.com/cloud/free/.
2. No console OCI, vá em **Compute > Instances > Create Instance**.
3. Escolha a imagem **Canonical Ubuntu 24.04**.
4. Em **Shape**, selecione **VM.Standard.A1.Flex** com **2 OCPUs** e **12 GB** de memória.
5. Em **Networking**, marque **Assign a public IPv4 address**.
6. Adicione sua chave SSH pública.
7. Crie a instância e anote o **IP público**.

## 5. Copiar e instalar o worker na VM

No seu terminal local, copie a pasta `worker/` para a VM:

```bash
scp -r worker ubuntu@<IP_DA_VM>:/home/ubuntu/
ssh ubuntu@<IP_DA_VM>
```

Na VM:

```bash
sudo mv /home/ubuntu/worker /opt/karay-video-worker
cd /opt/karay-video-worker
sudo ./oci-setup.sh
```

O script instala Node.js, FFmpeg, as dependências e cria o serviço systemd `karay-video-worker`.

## 6. Configurar e iniciar o worker

Edite o arquivo de configuração na VM:

```bash
sudo nano /etc/karay/video-worker.env
```

Preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://zdifvgeyyugevhchtbie.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<sua_chave>
SUPABASE_VIDEO_ORIGINAIS_BUCKET=video-originals
SUPABASE_VIDEO_EDITADOS_BUCKET=video-edited
VIDEO_WORKER_API_KEY=<mesmo_valor_do_vercel>
VIDEO_MAX_FILE_SIZE_MB=2048
VIDEO_MAX_DURATION_SECONDS=600
VIDEO_WORKER_CONCURRENCY=2
VIDEO_WORKER_POLL_INTERVAL_MS=15000
```

Inicie e verifique o serviço:

```bash
sudo systemctl start karay-video-worker
sudo systemctl status karay-video-worker
sudo journalctl -u karay-video-worker -f
```

## 7. Testar o upload e renderização

1. Abra o admin em `/admin/editor-de-video`.
2. Clique em **Criar templates padrão** (apenas na primeira vez).
3. Selecione uma modelo, um template (ex: `Instagram Reels — Básico`) e faça upload de um vídeo.
4. O job aparecerá na tabela como `pending`.
5. Clique em **Aprovar**.
6. O worker OCI deverá processar o vídeo e atualizar o status para `completed`.
7. Use o botão **Visualizar** para ver o vídeo editado via URL assinada.

## Próxima etapa (por modelo)

Quando você abrir o perfil de uma modelo no admin e clicar na aba **Vídeo**, aparecerá automaticamente um checklist com 3 itens:

1. Criar conta Google individual da modelo.
2. Compartilhar pastas do Google Drive com a agência.
3. Definir template padrão e plataforma.

Marque cada item conforme for concluído.
