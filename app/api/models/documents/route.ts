import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateManagementRequest } from "@/lib/api/auth";

const BUCKET_NAME = "model-documents";
const MAX_DOCUMENTS = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

type DocumentRecord = {
  id: string;
  model_id: string;
  description: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
};

export async function GET(
  request: Request,
) {
  try {
    const auth =
      await authenticateManagementRequest({
        messages: {
          unauthenticated: "Não autenticado.",
          inactiveProfile: "Perfil inválido.",
        },
      });

    if (!auth.ok) {
      return auth.response;
    }

    const url =
      new URL(request.url);

    const modelId =
      url.searchParams.get("modelId");

    if (!modelId) {
      return NextResponse.json(
        {
          error:
            "Identificação da modelo não informada.",
        },
        {
          status: 400,
        },
      );
    }

    const admin =
      createAdminClient();

    const {
      data: documents,
      error: documentsError,
    } = await admin
      .from("model_documents")
      .select(
        `
          id,
          model_id,
          description,
          file_name,
          storage_path,
          mime_type,
          file_size,
          created_at,
          updated_at
        `,
      )
      .eq("model_id", modelId)
      .order("created_at", {
        ascending: false,
      });

    if (documentsError) {
      return NextResponse.json(
        {
          error:
            documentsError.message,
        },
        {
          status: 500,
        },
      );
    }

    const documentsWithUrls =
      await Promise.all(
        (
          (documents ??
            []) as DocumentRecord[]
        ).map(async (document) => {
          const {
            data: signedUrlData,
            error: signedUrlError,
          } = await admin.storage
            .from(BUCKET_NAME)
            .createSignedUrl(
              document.storage_path,
              60 * 60,
              {
                download:
                  document.file_name,
              },
            );

          return {
            ...document,
            downloadUrl:
              signedUrlError
                ? null
                : signedUrlData.signedUrl,
          };
        }),
      );

    return NextResponse.json({
      documents: documentsWithUrls,
      limit: MAX_DOCUMENTS,
    });
  } catch (error) {
    console.error(
      "Erro ao carregar documentos:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao carregar documentos.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    const auth =
      await authenticateManagementRequest({
        allowedRoles: ["owner", "administrator"],
        messages: {
          unauthenticated: "Não autenticado.",
          inactiveProfile: "Perfil inválido.",
          forbidden: "Sem permissão.",
        },
      });

    if (!auth.ok) {
      return auth.response;
    }

    const formData =
      await request.formData();

    const modelId =
      formData.get("modelId");

    const description =
      formData.get("description");

    const uploadedFile =
      formData.get("file");

    if (
      typeof modelId !== "string" ||
      !modelId.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Identificação da modelo não informada.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      typeof description !== "string" ||
      !description.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Escreva uma descrição para o arquivo.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !(uploadedFile instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            "Selecione um arquivo.",
        },
        {
          status: 400,
        },
      );
    }

    if (uploadedFile.size === 0) {
      return NextResponse.json(
        {
          error:
            "O arquivo selecionado está vazio.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      uploadedFile.size >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            "O arquivo deve ter no máximo 25 MB.",
        },
        {
          status: 400,
        },
      );
    }

    const admin =
      createAdminClient();

    const {
      data: model,
      error: modelError,
    } = await admin
      .from("models")
      .select("id")
      .eq("id", modelId)
      .maybeSingle();

    if (modelError) {
      return NextResponse.json(
        {
          error: modelError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!model) {
      return NextResponse.json(
        {
          error:
            "Modelo não encontrada.",
        },
        {
          status: 404,
        },
      );
    }

    const {
      count,
      error: countError,
    } = await admin
      .from("model_documents")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("model_id", modelId);

    if (countError) {
      return NextResponse.json(
        {
          error: countError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (
      (count ?? 0) >=
      MAX_DOCUMENTS
    ) {
      return NextResponse.json(
        {
          error:
            "Esta modelo já possui o limite de 10 arquivos.",
        },
        {
          status: 400,
        },
      );
    }

    const safeFileName =
      sanitizeFileName(
        uploadedFile.name,
      );

    const storagePath =
      `${modelId}/${randomUUID()}-${safeFileName}`;

    const fileBuffer =
      Buffer.from(
        await uploadedFile.arrayBuffer(),
      );

    const {
      error: uploadError,
    } = await admin.storage
      .from(BUCKET_NAME)
      .upload(
        storagePath,
        fileBuffer,
        {
          contentType:
            uploadedFile.type ||
            "application/octet-stream",
          upsert: false,
        },
      );

    if (uploadError) {
      return NextResponse.json(
        {
          error: uploadError.message,
        },
        {
          status: 500,
        },
      );
    }

    const {
      data: document,
      error: insertError,
    } = await admin
      .from("model_documents")
      .insert({
        model_id: modelId,
        description:
          description.trim(),
        file_name:
          uploadedFile.name,
        storage_path:
          storagePath,
        mime_type:
          uploadedFile.type ||
          null,
        file_size:
          uploadedFile.size,
      })
      .select(
        `
          id,
          model_id,
          description,
          file_name,
          storage_path,
          mime_type,
          file_size,
          created_at,
          updated_at
        `,
      )
      .single<DocumentRecord>();

    if (insertError) {
      await admin.storage
        .from(BUCKET_NAME)
        .remove([storagePath]);

      return NextResponse.json(
        {
          error: insertError.message,
        },
        {
          status: 500,
        },
      );
    }

    const {
      data: signedUrlData,
    } = await admin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(
        storagePath,
        60 * 60,
        {
          download:
            document.file_name,
        },
      );

    return NextResponse.json(
      {
        document: {
          ...document,
          downloadUrl:
            signedUrlData?.signedUrl ??
            null,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Erro ao enviar documento:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao enviar documento.",
      },
      {
        status: 500,
      },
    );
  }
}

function sanitizeFileName(
  fileName: string,
) {
  const normalizedName =
    fileName
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "-",
      )
      .replace(/-+/g, "-")
      .replace(
        /^[-.]+|[-.]+$/g,
        "",
      );

  return (
    normalizedName ||
    "arquivo"
  );
}