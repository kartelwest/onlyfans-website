"use client";

import { useEffect, useState } from "react";
import ModelPhotoUpload from "./ModelPhotoUpload";

type SupportedLanguage =
  | "English"
  | "Portuguese"
  | "Spanish";

export type EditableModelProfile = {
  fullName: string;
  stageName: string;
  profilePhoto: string;

  dateOfBirth: string;
  country: string;
  city: string;
  preferredLanguage: SupportedLanguage;
  languagesSpoken: SupportedLanguage[];
  timezone: string;

  email: string;
  whatsapp: string;

  emergencyContactName: string;
  emergencyContactPhone: string;

  dateJoined: string;
  accountStatus: string;
  assignedManager: string;

  onlyFansApprovalDate: string;
  lastUpload: string;

  bankAccountLinked: string;
  bankName: string;
  accountHolder: string;
  lastBankVerification: string;
  pixRegistered: string;
  paymentStatus: string;
};

type EditableModelInfoProps = {
  slug: string;
  defaultName: string;
  modelNumber: number;
  lastLogin: string;
  contentStatus: string;
};

const supportedLanguages: SupportedLanguage[] = [
  "English",
  "Portuguese",
  "Spanish",
];

const emptyProfile: EditableModelProfile = {
  fullName: "",
  stageName: "",
  profilePhoto: "",

  dateOfBirth: "",
  country: "",
  city: "",
  preferredLanguage: "Portuguese",
  languagesSpoken: [],
  timezone: "America/Sao_Paulo",

  email: "",
  whatsapp: "",

  emergencyContactName: "",
  emergencyContactPhone: "",

  dateJoined: "",
  accountStatus: "Onboarding",
  assignedManager: "Kartel",

  onlyFansApprovalDate: "",
  lastUpload: "",

  bankAccountLinked: "Não",
  bankName: "",
  accountHolder: "",
  lastBankVerification: "",
  pixRegistered: "Não",
  paymentStatus: "Não iniciado",
};

function createInitialProfile(
  defaultName: string
): EditableModelProfile {
  return {
    ...emptyProfile,
    fullName: defaultName,
    stageName: defaultName,
    languagesSpoken: [],
  };
}

export default function EditableModelInfo({
  slug,
  defaultName,
  modelNumber,
  lastLogin,
  contentStatus,
}: EditableModelInfoProps) {
  const storageKey = `karaymodels-profile-${slug}`;

  const [profile, setProfile] =
    useState<EditableModelProfile>(() =>
      createInitialProfile(defaultName)
    );

  const [draftProfile, setDraftProfile] =
    useState<EditableModelProfile>(() =>
      createInitialProfile(defaultName)
    );

  const [isEditing, setIsEditing] =
    useState(false);

  const [hasLoaded, setHasLoaded] =
    useState(false);

  const [saveMessage, setSaveMessage] =
    useState("");

  useEffect(() => {
    const initialProfile =
      createInitialProfile(defaultName);

    try {
      const savedProfile =
        window.localStorage.getItem(storageKey);

      if (savedProfile) {
        const parsedProfile = JSON.parse(
          savedProfile
        ) as Partial<EditableModelProfile> & {
          avatarUrl?: string;
        };

        const mergedProfile: EditableModelProfile = {
          ...initialProfile,
          ...parsedProfile,

          profilePhoto:
            parsedProfile.profilePhoto ||
            parsedProfile.avatarUrl ||
            "",

          languagesSpoken: Array.isArray(
            parsedProfile.languagesSpoken
          )
            ? parsedProfile.languagesSpoken.filter(
                (
                  language
                ): language is SupportedLanguage =>
                  supportedLanguages.includes(
                    language as SupportedLanguage
                  )
              )
            : [],
        };

        setProfile(mergedProfile);
        setDraftProfile(mergedProfile);
      } else {
        setProfile(initialProfile);
        setDraftProfile(initialProfile);
      }
    } catch (error) {
      console.error(
        "Não foi possível carregar as informações da modelo:",
        error
      );

      setProfile(initialProfile);
      setDraftProfile(initialProfile);
    } finally {
      setHasLoaded(true);
    }
  }, [defaultName, storageKey]);

  function updateDraft(
    field: keyof EditableModelProfile,
    value: string
  ) {
    setDraftProfile((currentProfile) => ({
      ...currentProfile,
      [field]: value,
    }));
  }

  function toggleSpokenLanguage(
    language: SupportedLanguage
  ) {
    setDraftProfile((currentProfile) => {
      const languageExists =
        currentProfile.languagesSpoken.includes(
          language
        );

      return {
        ...currentProfile,
        languagesSpoken: languageExists
          ? currentProfile.languagesSpoken.filter(
              (currentLanguage) =>
                currentLanguage !== language
            )
          : [
              ...currentProfile.languagesSpoken,
              language,
            ],
      };
    });
  }

  function startEditing() {
    setDraftProfile(profile);
    setSaveMessage("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftProfile(profile);
    setSaveMessage("");
    setIsEditing(false);
  }

  function saveProfile() {
    const cleanedProfile: EditableModelProfile = {
      ...draftProfile,

      fullName:
        draftProfile.fullName.trim() ||
        defaultName,

      stageName:
        draftProfile.stageName.trim() ||
        defaultName,

      profilePhoto:
        draftProfile.profilePhoto,

      country:
        draftProfile.country.trim(),

      city:
        draftProfile.city.trim(),

      timezone:
        draftProfile.timezone.trim() ||
        "America/Sao_Paulo",

      email:
        draftProfile.email.trim(),

      whatsapp:
        draftProfile.whatsapp.trim(),

      emergencyContactName:
        draftProfile.emergencyContactName.trim(),

      emergencyContactPhone:
        draftProfile.emergencyContactPhone.trim(),

      assignedManager:
        draftProfile.assignedManager.trim() ||
        "Kartel",

      bankName:
        draftProfile.bankName.trim(),

      accountHolder:
        draftProfile.accountHolder.trim(),
    };

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(cleanedProfile)
      );

      setProfile(cleanedProfile);
      setDraftProfile(cleanedProfile);
      setIsEditing(false);

      setSaveMessage(
        "Informações salvas com sucesso."
      );
    } catch (error) {
      console.error(
        "Não foi possível salvar as informações da modelo:",
        error
      );

      setSaveMessage(
        "Não foi possível salvar as informações. A foto pode estar grande demais para o armazenamento do navegador."
      );
    }
  }

  if (!hasLoaded) {
    return (
      <section className="rounded-2xl border border-pink-400/20 bg-[#111114] p-6">
        <p className="text-sm text-zinc-400">
          Carregando informações...
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-pink-400/20 bg-[#111114] p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-pink-300">
            Visão geral
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            Informações da modelo
          </h2>
        </div>

        <div className="flex flex-wrap gap-3">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-400 hover:text-white"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={saveProfile}
                className="rounded-lg border border-green-500/50 bg-green-500/15 px-4 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-500 hover:text-black"
              >
                Salvar alterações
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-lg border border-pink-400/50 bg-pink-400/10 px-4 py-2 text-sm font-semibold text-pink-200 transition hover:bg-pink-400 hover:text-black"
            >
              Editar informações
            </button>
          )}
        </div>
      </div>

      {saveMessage && (
        <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-300">
          {saveMessage}
        </div>
      )}

      <ProfileSection
        eyebrow="Identificação"
        title="Identidade da modelo"
      >
        <ModelPhotoUpload
          photo={
            isEditing
              ? draftProfile.profilePhoto
              : profile.profilePhoto
          }
          modelName={
            isEditing
              ? draftProfile.stageName
              : profile.stageName
          }
          isEditing={isEditing}
          onPhotoChange={(photo) =>
            updateDraft("profilePhoto", photo)
          }
        />

        <EditableField
          label="Nome completo"
          value={draftProfile.fullName}
          displayValue={profile.fullName}
          isEditing={isEditing}
          onChange={(value) =>
            updateDraft("fullName", value)
          }
        />

        <EditableField
          label="Nome artístico"
          value={draftProfile.stageName}
          displayValue={profile.stageName}
          isEditing={isEditing}
          onChange={(value) =>
            updateDraft("stageName", value)
          }
        />

        <ReadOnlyField
          label="Número interno da modelo"
          value={`#${modelNumber}`}
        />

        <EditableField
          label="Data de nascimento"
          value={draftProfile.dateOfBirth}
          displayValue={
            profile.dateOfBirth ||
            "Não registrada"
          }
          isEditing={isEditing}
          type="date"
          onChange={(value) =>
            updateDraft("dateOfBirth", value)
          }
        />

        <SelectField
          label="Status da conta"
          value={draftProfile.accountStatus}
          displayValue={profile.accountStatus}
          isEditing={isEditing}
          options={[
            "Onboarding",
            "Ativa",
            "Pausada",
            "Inativa",
            "Problema",
          ]}
          onChange={(value) =>
            updateDraft(
              "accountStatus",
              value
            )
          }
        />
      </ProfileSection>

      <ProfileSection
        eyebrow="Localização e comunicação"
        title="Idioma e localização"
      >
        <EditableField
          label="País"
          value={draftProfile.country}
          displayValue={
            profile.country || "Não informado"
          }
          isEditing={isEditing}
          onChange={(value) =>
            updateDraft("country", value)
          }
        />

        <EditableField
          label="Cidade"
          value={draftProfile.city}
          displayValue={
            profile.city || "Não informada"
          }
          isEditing={isEditing}
          onChange={(value) =>
            updateDraft("city", value)
          }
        />

        <EditableField
          label="Fuso horário"
          value={draftProfile.timezone}
          displayValue={
            profile.timezone ||
            "Não informado"
          }
          isEditing={isEditing}
          placeholder="America/Sao_Paulo"
          onChange={(value) =>
            updateDraft("timezone", value)
          }
        />

        <SelectField
          label="Idioma preferido"
          value={
            draftProfile.preferredLanguage
          }
          displayValue={
            profile.preferredLanguage
          }
          isEditing={isEditing}
          options={[
            "English",
            "Portuguese",
            "Spanish",
          ]}
          onChange={(value) =>
            updateDraft(
              "preferredLanguage",
              value
            )
          }
        />

        <LanguagesField
          label="Idiomas falados"
          selectedLanguages={
            draftProfile.languagesSpoken
          }
          displayLanguages={
            profile.languagesSpoken
          }
          isEditing={isEditing}
          onToggle={toggleSpokenLanguage}
        />
      </ProfileSection>

      <ProfileSection
        eyebrow="Contato"
        title="Informações de contato"
      >
        <EditableField
          label="E-mail"
          value={draftProfile.email}
          displayValue={
            profile.email || "Não informado"
          }
          isEditing={isEditing}
          type="email"
          onChange={(value) =>
            updateDraft("email", value)
          }
        />

        <EditableField
          label="WhatsApp"
          value={draftProfile.whatsapp}
          displayValue={
            profile.whatsapp || "Não informado"
          }
          isEditing={isEditing}
          type="tel"
          onChange={(value) =>
            updateDraft("whatsapp", value)
          }
        />

        <EditableField
          label="Contato de emergência"
          value={
            draftProfile.emergencyContactName
          }
          displayValue={
            profile.emergencyContactName ||
            "Não informado"
          }
          isEditing={isEditing}
          onChange={(value) =>
            updateDraft(
              "emergencyContactName",
              value
            )
          }
        />

        <EditableField
          label="Telefone de emergência"
          value={
            draftProfile.emergencyContactPhone
          }
          displayValue={
            profile.emergencyContactPhone ||
            "Não informado"
          }
          isEditing={isEditing}
          type="tel"
          onChange={(value) =>
            updateDraft(
              "emergencyContactPhone",
              value
            )
          }
        />
      </ProfileSection>

      <ProfileSection
        eyebrow="Administração"
        title="Dados administrativos"
      >
        <EditableField
          label="Data de entrada"
          value={draftProfile.dateJoined}
          displayValue={
            profile.dateJoined ||
            "Não registrada"
          }
          isEditing={isEditing}
          type="date"
          onChange={(value) =>
            updateDraft("dateJoined", value)
          }
        />

        <ReadOnlyField
          label="Último login"
          value={lastLogin}
        />

        <EditableField
          label="Último upload"
          value={draftProfile.lastUpload}
          displayValue={
            profile.lastUpload ||
            "Não registrado"
          }
          isEditing={isEditing}
          type="datetime-local"
          onChange={(value) =>
            updateDraft("lastUpload", value)
          }
        />

        <EditableField
          label="Responsável"
          value={
            draftProfile.assignedManager
          }
          displayValue={
            profile.assignedManager ||
            "Kartel"
          }
          isEditing={isEditing}
          onChange={(value) =>
            updateDraft(
              "assignedManager",
              value
            )
          }
        />

        <EditableField
          label="Aprovação do OnlyFans"
          value={
            draftProfile.onlyFansApprovalDate
          }
          displayValue={
            profile.onlyFansApprovalDate ||
            "Não registrada"
          }
          isEditing={isEditing}
          type="date"
          onChange={(value) =>
            updateDraft(
              "onlyFansApprovalDate",
              value
            )
          }
        />

        <ReadOnlyField
          label="Status do conteúdo"
          value={contentStatus}
        />
      </ProfileSection>

      <ProfileSection
        eyebrow="Financeiro"
        title="Informações bancárias e pagamentos"
      >
        <SelectField
          label="Conta bancária"
          value={
            draftProfile.bankAccountLinked
          }
          displayValue={
            profile.bankAccountLinked
          }
          isEditing={isEditing}
          options={[
            "Não",
            "Em andamento",
            "Skrill (USD)",
            "Banco Brasileiro (BRL)",
            "Problema",
          ]}
          onChange={(value) =>
            updateDraft(
              "bankAccountLinked",
              value
            )
          }
        />

        <EditableField
          label="Nome do banco"
          value={draftProfile.bankName}
          displayValue={
            profile.bankName ||
            "Não informado"
          }
          isEditing={isEditing}
          onChange={(value) =>
            updateDraft("bankName", value)
          }
        />

        <EditableField
          label="Titular da conta"
          value={
            draftProfile.accountHolder
          }
          displayValue={
            profile.accountHolder ||
            "Não informado"
          }
          isEditing={isEditing}
          onChange={(value) =>
            updateDraft(
              "accountHolder",
              value
            )
          }
        />

        <EditableField
          label="Última verificação"
          value={
            draftProfile.lastBankVerification
          }
          displayValue={
            profile.lastBankVerification ||
            "Não registrada"
          }
          isEditing={isEditing}
          type="date"
          onChange={(value) =>
            updateDraft(
              "lastBankVerification",
              value
            )
          }
        />

        <SelectField
          label="PIX cadastrado"
          value={draftProfile.pixRegistered}
          displayValue={profile.pixRegistered}
          isEditing={isEditing}
          options={[
            "Não",
            "Sim",
            "Em andamento",
            "Não necessário",
            "Problema",
          ]}
          onChange={(value) =>
            updateDraft(
              "pixRegistered",
              value
            )
          }
        />

        <SelectField
          label="Status dos pagamentos"
          value={draftProfile.paymentStatus}
          displayValue={profile.paymentStatus}
          isEditing={isEditing}
          options={[
            "Não iniciado",
            "Em andamento",
            "Configurado",
            "Pagamento pendente",
            "Pagamento realizado",
            "Problema",
          ]}
          onChange={(value) =>
            updateDraft(
              "paymentStatus",
              value
            )
          }
        />
      </ProfileSection>
    </section>
  );
}

function ProfileSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 border-t border-white/10 pt-8 first:mt-0 first:border-t-0 first:pt-0">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-pink-300">
          {eyebrow}
        </p>

        <h3 className="mt-2 text-xl font-bold">
          {title}
        </h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  displayValue,
  isEditing,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  displayValue: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  type?:
    | "text"
    | "email"
    | "tel"
    | "date"
    | "datetime-local";
  placeholder?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </label>

      {isEditing ? (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="mt-3 w-full rounded-lg border border-pink-400/20 bg-[#0c0c0f] px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400"
        />
      ) : (
        <p className="mt-2 break-words font-semibold text-zinc-100">
          {displayValue}
        </p>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  displayValue,
  isEditing,
  options,
  onChange,
}: {
  label: string;
  value: string;
  displayValue: string;
  isEditing: boolean;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </label>

      {isEditing ? (
        <select
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="mt-3 w-full rounded-lg border border-pink-400/20 bg-[#0c0c0f] px-3 py-2 text-sm text-white outline-none transition focus:border-pink-400"
        >
          {options.map((option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-2 break-words font-semibold text-zinc-100">
          {displayValue}
        </p>
      )}
    </div>
  );
}

function LanguagesField({
  label,
  selectedLanguages,
  displayLanguages,
  isEditing,
  onToggle,
}: {
  label: string;
  selectedLanguages: SupportedLanguage[];
  displayLanguages: SupportedLanguage[];
  isEditing: boolean;
  onToggle: (
    language: SupportedLanguage
  ) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 sm:col-span-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>

      {isEditing ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {supportedLanguages.map(
            (language) => (
              <label
                key={language}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-[#0c0c0f] px-3 py-3 transition hover:border-pink-400/40"
              >
                <input
                  type="checkbox"
                  checked={selectedLanguages.includes(
                    language
                  )}
                  onChange={() =>
                    onToggle(language)
                  }
                  className="h-4 w-4 accent-pink-400"
                />

                <span className="text-sm font-semibold text-zinc-200">
                  {language}
                </span>
              </label>
            )
          )}
        </div>
      ) : (
        <p className="mt-2 break-words font-semibold text-zinc-100">
          {displayLanguages.length > 0
            ? displayLanguages.join(", ")
            : "Nenhum idioma informado"}
        </p>
      )}
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>

      <p className="mt-2 break-words font-semibold text-zinc-100">
        {value}
      </p>
    </div>
  );
}