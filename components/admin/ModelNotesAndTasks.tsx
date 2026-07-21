"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type NoteResponsible = "Modelo" | "Agência" | "Ambos";

type NoteStatus =
  | "Aberta"
  | "Em acompanhamento"
  | "Resolvida";

type TaskStatus =
  | "Não iniciada"
  | "Em andamento"
  | "Aguardando modelo"
  | "Aguardando agência"
  | "Concluída"
  | "Problema";

type TaskPriority =
  | "Baixa"
  | "Normal"
  | "Alta"
  | "Urgente";

type Platform =
  | "Geral"
  | "OnlyFans"
  | "Instagram"
  | "X / Twitter"
  | "TikTok"
  | "Reddit"
  | "YouTube"
  | "Financeiro"
  | "Conteúdo"
  | "Documentação";

type ActivityType =
  | "Nota criada"
  | "Nota atualizada"
  | "Nota excluída"
  | "Tarefa criada"
  | "Tarefa atualizada"
  | "Tarefa concluída"
  | "Tarefa excluída";

type ModelNote = {
  id: string;
  text: string;
  responsible: NoteResponsible;
  status: NoteStatus;
  dueDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type AgencyTask = {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
  platform: Platform;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string;
};

type ActivityEntry = {
  id: string;
  type: ActivityType;
  description: string;
  createdBy: string;
  createdAt: string;
};

type StoredWorkspace = {
  notes: ModelNote[];
  tasks: AgencyTask[];
  activity: ActivityEntry[];
};

type ModelNotesAndTasksProps = {
  slug: string;
  modelName: string;
};

const emptyWorkspace: StoredWorkspace = {
  notes: [],
  tasks: [],
  activity: [],
};

const noteResponsibleOptions: NoteResponsible[] = [
  "Modelo",
  "Agência",
  "Ambos",
];

const noteStatusOptions: NoteStatus[] = [
  "Aberta",
  "Em acompanhamento",
  "Resolvida",
];

const taskStatusOptions: TaskStatus[] = [
  "Não iniciada",
  "Em andamento",
  "Aguardando modelo",
  "Aguardando agência",
  "Concluída",
  "Problema",
];

const taskPriorityOptions: TaskPriority[] = [
  "Baixa",
  "Normal",
  "Alta",
  "Urgente",
];

const platformOptions: Platform[] = [
  "Geral",
  "OnlyFans",
  "Instagram",
  "X / Twitter",
  "TikTok",
  "Reddit",
  "YouTube",
  "Financeiro",
  "Conteúdo",
  "Documentação",
];

function createId(prefix: string) {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createTimestamp() {
  return new Date().toISOString();
}

function formatDateTime(value: string) {
  if (!value) {
    return "Não registrado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string) {
  if (!value) {
    return "Sem prazo";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(`${value}T12:00:00`));
}

function isOverdue(dueDate: string, status: TaskStatus) {
  if (!dueDate || status === "Concluída") {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(`${dueDate}T00:00:00`);

  return deadline < today;
}

export default function ModelNotesAndTasks({
  slug,
  modelName,
}: ModelNotesAndTasksProps) {
  const storageKey = `karaymodels-workspace-${slug}`;

  const [workspace, setWorkspace] =
    useState<StoredWorkspace>(emptyWorkspace);

  const [hasLoaded, setHasLoaded] =
    useState(false);

  const [activeSection, setActiveSection] =
    useState<"notes" | "tasks" | "activity">("notes");

  const [showNoteForm, setShowNoteForm] =
    useState(false);

  const [showTaskForm, setShowTaskForm] =
    useState(false);

  const [editingNoteId, setEditingNoteId] =
    useState<string | null>(null);

  const [editingTaskId, setEditingTaskId] =
    useState<string | null>(null);

  const [noteText, setNoteText] =
    useState("");

  const [noteResponsible, setNoteResponsible] =
    useState<NoteResponsible>("Modelo");

  const [noteStatus, setNoteStatus] =
    useState<NoteStatus>("Aberta");

  const [noteDueDate, setNoteDueDate] =
    useState("");

  const [noteCreatedBy, setNoteCreatedBy] =
    useState("Kartel");

  const [taskTitle, setTaskTitle] =
    useState("");

  const [taskDescription, setTaskDescription] =
    useState("");

  const [taskAssignedTo, setTaskAssignedTo] =
    useState("Kartel");

  const [taskPriority, setTaskPriority] =
    useState<TaskPriority>("Normal");

  const [taskDueDate, setTaskDueDate] =
    useState("");

  const [taskStatus, setTaskStatus] =
    useState<TaskStatus>("Não iniciada");

  const [taskPlatform, setTaskPlatform] =
    useState<Platform>("Geral");

  const [taskCreatedBy, setTaskCreatedBy] =
    useState("Kartel");

  useEffect(() => {
    try {
      const savedWorkspace =
        window.localStorage.getItem(storageKey);

      if (savedWorkspace) {
        const parsedWorkspace = JSON.parse(
          savedWorkspace
        ) as Partial<StoredWorkspace>;

        setWorkspace({
          notes: Array.isArray(parsedWorkspace.notes)
            ? parsedWorkspace.notes
            : [],
          tasks: Array.isArray(parsedWorkspace.tasks)
            ? parsedWorkspace.tasks
            : [],
          activity: Array.isArray(
            parsedWorkspace.activity
          )
            ? parsedWorkspace.activity
            : [],
        });
      } else {
        setWorkspace(emptyWorkspace);
      }
    } catch (error) {
      console.error(
        "Não foi possível carregar as notas e tarefas:",
        error
      );

      setWorkspace(emptyWorkspace);
    } finally {
      setHasLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(workspace)
      );
    } catch (error) {
      console.error(
        "Não foi possível salvar as notas e tarefas:",
        error
      );
    }
  }, [hasLoaded, storageKey, workspace]);

  const openNotes = useMemo(
    () =>
      workspace.notes.filter(
        (note) => note.status !== "Resolvida"
      ).length,
    [workspace.notes]
  );

  const pendingTasks = useMemo(
    () =>
      workspace.tasks.filter(
        (task) => task.status !== "Concluída"
      ).length,
    [workspace.tasks]
  );

  const overdueTasks = useMemo(
    () =>
      workspace.tasks.filter((task) =>
        isOverdue(task.dueDate, task.status)
      ).length,
    [workspace.tasks]
  );

  function addActivity(
    type: ActivityType,
    description: string,
    createdBy: string
  ) {
    const activityEntry: ActivityEntry = {
      id: createId("activity"),
      type,
      description,
      createdBy:
        createdBy.trim() || "Administrador",
      createdAt: createTimestamp(),
    };

    setWorkspace((currentWorkspace) => ({
      ...currentWorkspace,
      activity: [
        activityEntry,
        ...currentWorkspace.activity,
      ],
    }));
  }

  function resetNoteForm() {
    setEditingNoteId(null);
    setNoteText("");
    setNoteResponsible("Modelo");
    setNoteStatus("Aberta");
    setNoteDueDate("");
    setNoteCreatedBy("Kartel");
    setShowNoteForm(false);
  }

  function resetTaskForm() {
    setEditingTaskId(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskAssignedTo("Kartel");
    setTaskPriority("Normal");
    setTaskDueDate("");
    setTaskStatus("Não iniciada");
    setTaskPlatform("Geral");
    setTaskCreatedBy("Kartel");
    setShowTaskForm(false);
  }

  function handleNoteSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanedText = noteText.trim();

    if (!cleanedText) {
      return;
    }

    const timestamp = createTimestamp();

    if (editingNoteId) {
      const existingNote = workspace.notes.find(
        (note) => note.id === editingNoteId
      );

      setWorkspace((currentWorkspace) => ({
        ...currentWorkspace,
        notes: currentWorkspace.notes.map(
          (note) =>
            note.id === editingNoteId
              ? {
                  ...note,
                  text: cleanedText,
                  responsible: noteResponsible,
                  status: noteStatus,
                  dueDate: noteDueDate,
                  createdBy:
                    noteCreatedBy.trim() ||
                    "Administrador",
                  updatedAt: timestamp,
                }
              : note
        ),
      }));

      addActivity(
        "Nota atualizada",
        `Nota atualizada: ${
          existingNote?.text || cleanedText
        }`,
        noteCreatedBy
      );
    } else {
      const newNote: ModelNote = {
        id: createId("note"),
        text: cleanedText,
        responsible: noteResponsible,
        status: noteStatus,
        dueDate: noteDueDate,
        createdBy:
          noteCreatedBy.trim() || "Administrador",
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      setWorkspace((currentWorkspace) => ({
        ...currentWorkspace,
        notes: [
          newNote,
          ...currentWorkspace.notes,
        ],
      }));

      addActivity(
        "Nota criada",
        `Nova nota adicionada: ${cleanedText}`,
        noteCreatedBy
      );
    }

    resetNoteForm();
  }

  function editNote(note: ModelNote) {
    setEditingNoteId(note.id);
    setNoteText(note.text);
    setNoteResponsible(note.responsible);
    setNoteStatus(note.status);
    setNoteDueDate(note.dueDate);
    setNoteCreatedBy(note.createdBy);
    setShowNoteForm(true);
  }

  function resolveNote(note: ModelNote) {
    const timestamp = createTimestamp();

    setWorkspace((currentWorkspace) => ({
      ...currentWorkspace,
      notes: currentWorkspace.notes.map(
        (currentNote) =>
          currentNote.id === note.id
            ? {
                ...currentNote,
                status: "Resolvida",
                updatedAt: timestamp,
              }
            : currentNote
      ),
    }));

    addActivity(
      "Nota atualizada",
      `Nota marcada como resolvida: ${note.text}`,
      "Kartel"
    );
  }

  function deleteNote(note: ModelNote) {
    const confirmed = window.confirm(
      "Tem certeza de que deseja excluir esta nota?"
    );

    if (!confirmed) {
      return;
    }

    setWorkspace((currentWorkspace) => ({
      ...currentWorkspace,
      notes: currentWorkspace.notes.filter(
        (currentNote) =>
          currentNote.id !== note.id
      ),
    }));

    addActivity(
      "Nota excluída",
      `Nota excluída: ${note.text}`,
      "Kartel"
    );
  }

  function handleTaskSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanedTitle = taskTitle.trim();

    if (!cleanedTitle) {
      return;
    }

    const timestamp = createTimestamp();

    if (editingTaskId) {
      const existingTask = workspace.tasks.find(
        (task) => task.id === editingTaskId
      );

      const completedAt =
        taskStatus === "Concluída"
          ? existingTask?.completedAt ||
            timestamp
          : "";

      setWorkspace((currentWorkspace) => ({
        ...currentWorkspace,
        tasks: currentWorkspace.tasks.map(
          (task) =>
            task.id === editingTaskId
              ? {
                  ...task,
                  title: cleanedTitle,
                  description:
                    taskDescription.trim(),
                  assignedTo:
                    taskAssignedTo.trim() ||
                    "Kartel",
                  priority: taskPriority,
                  dueDate: taskDueDate,
                  status: taskStatus,
                  platform: taskPlatform,
                  createdBy:
                    taskCreatedBy.trim() ||
                    "Administrador",
                  updatedAt: timestamp,
                  completedAt,
                }
              : task
        ),
      }));

      addActivity(
        taskStatus === "Concluída"
          ? "Tarefa concluída"
          : "Tarefa atualizada",
        `Tarefa atualizada: ${cleanedTitle}`,
        taskCreatedBy
      );
    } else {
      const newTask: AgencyTask = {
        id: createId("task"),
        title: cleanedTitle,
        description:
          taskDescription.trim(),
        assignedTo:
          taskAssignedTo.trim() || "Kartel",
        priority: taskPriority,
        dueDate: taskDueDate,
        status: taskStatus,
        platform: taskPlatform,
        createdBy:
          taskCreatedBy.trim() ||
          "Administrador",
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt:
          taskStatus === "Concluída"
            ? timestamp
            : "",
      };

      setWorkspace((currentWorkspace) => ({
        ...currentWorkspace,
        tasks: [
          newTask,
          ...currentWorkspace.tasks,
        ],
      }));

      addActivity(
        taskStatus === "Concluída"
          ? "Tarefa concluída"
          : "Tarefa criada",
        `Nova tarefa criada: ${cleanedTitle}`,
        taskCreatedBy
      );
    }

    resetTaskForm();
  }

  function editTask(task: AgencyTask) {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskDescription(task.description);
    setTaskAssignedTo(task.assignedTo);
    setTaskPriority(task.priority);
    setTaskDueDate(task.dueDate);
    setTaskStatus(task.status);
    setTaskPlatform(task.platform);
    setTaskCreatedBy(task.createdBy);
    setShowTaskForm(true);
  }

  function completeTask(task: AgencyTask) {
    if (task.status === "Concluída") {
      return;
    }

    const timestamp = createTimestamp();

    setWorkspace((currentWorkspace) => ({
      ...currentWorkspace,
      tasks: currentWorkspace.tasks.map(
        (currentTask) =>
          currentTask.id === task.id
            ? {
                ...currentTask,
                status: "Concluída",
                updatedAt: timestamp,
                completedAt: timestamp,
              }
            : currentTask
      ),
    }));

    addActivity(
      "Tarefa concluída",
      `Tarefa concluída: ${task.title}`,
      "Kartel"
    );
  }

  function deleteTask(task: AgencyTask) {
    const confirmed = window.confirm(
      "Tem certeza de que deseja excluir esta tarefa?"
    );

    if (!confirmed) {
      return;
    }

    setWorkspace((currentWorkspace) => ({
      ...currentWorkspace,
      tasks: currentWorkspace.tasks.filter(
        (currentTask) =>
          currentTask.id !== task.id
      ),
    }));

    addActivity(
      "Tarefa excluída",
      `Tarefa excluída: ${task.title}`,
      "Kartel"
    );
  }

  if (!hasLoaded) {
    return (
      <section className="rounded-2xl border border-pink-400/20 bg-[#111114] p-6">
        <p className="text-sm text-zinc-400">
          Carregando notas e tarefas...
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-pink-400/20 bg-[#111114] p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-pink-300">
            Administração da modelo
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            Notas, tarefas e histórico
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Acompanhamento interno de {modelName}.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <SummaryCard
            label="Notas abertas"
            value={openNotes}
          />

          <SummaryCard
            label="Tarefas pendentes"
            value={pendingTasks}
          />

          <SummaryCard
            label="Atrasadas"
            value={overdueTasks}
            warning={overdueTasks > 0}
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 border-b border-white/10 pb-5">
        <TabButton
          active={activeSection === "notes"}
          onClick={() =>
            setActiveSection("notes")
          }
        >
          Notas
        </TabButton>

        <TabButton
          active={activeSection === "tasks"}
          onClick={() =>
            setActiveSection("tasks")
          }
        >
          Tarefas
        </TabButton>

        <TabButton
          active={activeSection === "activity"}
          onClick={() =>
            setActiveSection("activity")
          }
        >
          Histórico
        </TabButton>
      </div>

      {activeSection === "notes" && (
        <div className="mt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold">
                Notas internas
              </h3>

              <p className="mt-1 text-sm text-zinc-400">
                Registre observações, problemas e
                acompanhamentos.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                resetNoteForm();
                setShowNoteForm(true);
              }}
              className="rounded-lg border border-pink-400/50 bg-pink-400/10 px-4 py-2 text-sm font-semibold text-pink-200 transition hover:bg-pink-400 hover:text-black"
            >
              Nova nota
            </button>
          </div>

          {showNoteForm && (
            <form
              onSubmit={handleNoteSubmit}
              className="mt-6 rounded-2xl border border-pink-400/20 bg-black/20 p-5"
            >
              <h4 className="text-lg font-bold">
                {editingNoteId
                  ? "Editar nota"
                  : "Adicionar nota"}
              </h4>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel>
                    Observação
                  </FieldLabel>

                  <textarea
                    value={noteText}
                    onChange={(event) =>
                      setNoteText(
                        event.target.value
                      )
                    }
                    rows={4}
                    required
                    placeholder="Exemplo: precisa enviar mais 30 vídeos..."
                    className={inputClasses}
                  />
                </div>

                <SelectInput
                  label="Responsável"
                  value={noteResponsible}
                  options={
                    noteResponsibleOptions
                  }
                  onChange={(value) =>
                    setNoteResponsible(
                      value as NoteResponsible
                    )
                  }
                />

                <SelectInput
                  label="Status"
                  value={noteStatus}
                  options={noteStatusOptions}
                  onChange={(value) =>
                    setNoteStatus(
                      value as NoteStatus
                    )
                  }
                />

                <TextInput
                  label="Prazo"
                  type="date"
                  value={noteDueDate}
                  onChange={setNoteDueDate}
                />

                <TextInput
                  label="Criado por"
                  value={noteCreatedBy}
                  onChange={setNoteCreatedBy}
                />
              </div>

              <FormActions
                onCancel={resetNoteForm}
                submitLabel={
                  editingNoteId
                    ? "Salvar nota"
                    : "Adicionar nota"
                }
              />
            </form>
          )}

          <div className="mt-6 space-y-4">
            {workspace.notes.length === 0 ? (
              <EmptyState message="Nenhuma nota cadastrada." />
            ) : (
              workspace.notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onEdit={() =>
                    editNote(note)
                  }
                  onResolve={() =>
                    resolveNote(note)
                  }
                  onDelete={() =>
                    deleteNote(note)
                  }
                />
              ))
            )}
          </div>
        </div>
      )}

      {activeSection === "tasks" && (
        <div className="mt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold">
                Tarefas da agência
              </h3>

              <p className="mt-1 text-sm text-zinc-400">
                Organize responsáveis, prioridades,
                plataformas e prazos.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                resetTaskForm();
                setShowTaskForm(true);
              }}
              className="rounded-lg border border-pink-400/50 bg-pink-400/10 px-4 py-2 text-sm font-semibold text-pink-200 transition hover:bg-pink-400 hover:text-black"
            >
              Nova tarefa
            </button>
          </div>

          {showTaskForm && (
            <form
              onSubmit={handleTaskSubmit}
              className="mt-6 rounded-2xl border border-pink-400/20 bg-black/20 p-5"
            >
              <h4 className="text-lg font-bold">
                {editingTaskId
                  ? "Editar tarefa"
                  : "Criar tarefa"}
              </h4>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Título"
                  value={taskTitle}
                  onChange={setTaskTitle}
                  required
                  placeholder="Exemplo: verificar conta do Instagram"
                />

                <TextInput
                  label="Responsável"
                  value={taskAssignedTo}
                  onChange={setTaskAssignedTo}
                  required
                />

                <div className="md:col-span-2">
                  <FieldLabel>
                    Descrição
                  </FieldLabel>

                  <textarea
                    value={taskDescription}
                    onChange={(event) =>
                      setTaskDescription(
                        event.target.value
                      )
                    }
                    rows={4}
                    placeholder="Inclua instruções e detalhes da tarefa..."
                    className={inputClasses}
                  />
                </div>

                <SelectInput
                  label="Prioridade"
                  value={taskPriority}
                  options={
                    taskPriorityOptions
                  }
                  onChange={(value) =>
                    setTaskPriority(
                      value as TaskPriority
                    )
                  }
                />

                <SelectInput
                  label="Status"
                  value={taskStatus}
                  options={taskStatusOptions}
                  onChange={(value) =>
                    setTaskStatus(
                      value as TaskStatus
                    )
                  }
                />

                <SelectInput
                  label="Plataforma ou área"
                  value={taskPlatform}
                  options={platformOptions}
                  onChange={(value) =>
                    setTaskPlatform(
                      value as Platform
                    )
                  }
                />

                <TextInput
                  label="Prazo"
                  type="date"
                  value={taskDueDate}
                  onChange={setTaskDueDate}
                />

                <TextInput
                  label="Criado por"
                  value={taskCreatedBy}
                  onChange={setTaskCreatedBy}
                />
              </div>

              <FormActions
                onCancel={resetTaskForm}
                submitLabel={
                  editingTaskId
                    ? "Salvar tarefa"
                    : "Criar tarefa"
                }
              />
            </form>
          )}

          <div className="mt-6 space-y-4">
            {workspace.tasks.length === 0 ? (
              <EmptyState message="Nenhuma tarefa cadastrada." />
            ) : (
              workspace.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={() =>
                    editTask(task)
                  }
                  onComplete={() =>
                    completeTask(task)
                  }
                  onDelete={() =>
                    deleteTask(task)
                  }
                />
              ))
            )}
          </div>
        </div>
      )}

      {activeSection === "activity" && (
        <div className="mt-6">
          <div>
            <h3 className="text-xl font-bold">
              Histórico de atividades
            </h3>

            <p className="mt-1 text-sm text-zinc-400">
              Registro automático das mudanças feitas
              nesta área.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {workspace.activity.length === 0 ? (
              <EmptyState message="Nenhuma atividade registrada." />
            ) : (
              workspace.activity.map(
                (activity) => (
                  <div
                    key={activity.id}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-white">
                          {activity.type}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-zinc-300">
                          {activity.description}
                        </p>
                      </div>

                      <span className="text-xs text-zinc-500">
                        {formatDateTime(
                          activity.createdAt
                        )}
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-zinc-500">
                      Por: {activity.createdBy}
                    </p>
                  </div>
                )
              )
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function NoteCard({
  note,
  onEdit,
  onResolve,
  onDelete,
}: {
  note: ModelNote;
  onEdit: () => void;
  onResolve: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={note.status} />

            <SmallBadge>
              Responsável: {note.responsible}
            </SmallBadge>

            <SmallBadge>
              Prazo: {formatDate(note.dueDate)}
            </SmallBadge>
          </div>

          <p className="mt-4 whitespace-pre-wrap leading-7 text-zinc-200">
            {note.text}
          </p>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
            <span>
              Criado por {note.createdBy}
            </span>

            <span>
              Criado em{" "}
              {formatDateTime(note.createdAt)}
            </span>

            {note.updatedAt !==
              note.createdAt && (
              <span>
                Atualizado em{" "}
                {formatDateTime(note.updatedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onEdit}>
            Editar
          </ActionButton>

          {note.status !== "Resolvida" && (
            <ActionButton
              onClick={onResolve}
              success
            >
              Resolver
            </ActionButton>
          )}

          <ActionButton
            onClick={onDelete}
            danger
          >
            Excluir
          </ActionButton>
        </div>
      </div>
    </article>
  );
}

function TaskCard({
  task,
  onEdit,
  onComplete,
  onDelete,
}: {
  task: AgencyTask;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const overdue = isOverdue(
    task.dueDate,
    task.status
  );

  return (
    <article
      className={`rounded-2xl border p-5 ${
        overdue
          ? "border-red-500/40 bg-red-500/5"
          : "border-white/10 bg-black/20"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={task.status} />

            <PriorityBadge
              priority={task.priority}
            />

            <SmallBadge>
              {task.platform}
            </SmallBadge>

            {overdue && (
              <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
                Atrasada
              </span>
            )}
          </div>

          <h4 className="mt-4 text-lg font-bold text-white">
            {task.title}
          </h4>

          {task.description && (
            <p className="mt-3 whitespace-pre-wrap leading-7 text-zinc-300">
              {task.description}
            </p>
          )}

          <div className="mt-4 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
            <span>
              Responsável: {task.assignedTo}
            </span>

            <span>
              Prazo: {formatDate(task.dueDate)}
            </span>

            <span>
              Criada por {task.createdBy}
            </span>

            <span>
              Criada em{" "}
              {formatDateTime(task.createdAt)}
            </span>

            {task.completedAt && (
              <span className="text-green-400">
                Concluída em{" "}
                {formatDateTime(
                  task.completedAt
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onEdit}>
            Editar
          </ActionButton>

          {task.status !== "Concluída" && (
            <ActionButton
              onClick={onComplete}
              success
            >
              Concluir
            </ActionButton>
          )}

          <ActionButton
            onClick={onDelete}
            danger
          >
            Excluir
          </ActionButton>
        </div>
      </div>
    </article>
  );
}

const inputClasses =
  "mt-2 w-full rounded-lg border border-pink-400/20 bg-[#0c0c0f] px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400";

function FieldLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>

      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className={inputClasses}
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className={inputClasses}
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
    </div>
  );
}

function FormActions({
  onCancel,
  submitLabel,
}: {
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-400 hover:text-white"
      >
        Cancelar
      </button>

      <button
        type="submit"
        className="rounded-lg border border-green-500/50 bg-green-500/15 px-4 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-500 hover:text-black"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-pink-400 bg-pink-400 text-black"
          : "border-white/10 bg-black/20 text-zinc-300 hover:border-pink-400/40 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div
      className={`min-w-[105px] rounded-xl border px-4 py-3 text-center ${
        warning
          ? "border-red-500/40 bg-red-500/10"
          : "border-white/10 bg-black/20"
      }`}
    >
      <p
        className={`text-xl font-bold ${
          warning
            ? "text-red-300"
            : "text-white"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
    </div>
  );
}

function StatusBadge({
  value,
}: {
  value: NoteStatus | TaskStatus;
}) {
  let classes =
    "border-zinc-500/40 bg-zinc-500/10 text-zinc-300";

  if (
    value === "Resolvida" ||
    value === "Concluída"
  ) {
    classes =
      "border-green-500/40 bg-green-500/10 text-green-300";
  }

  if (
    value === "Em acompanhamento" ||
    value === "Em andamento" ||
    value === "Aguardando modelo" ||
    value === "Aguardando agência"
  ) {
    classes =
      "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }

  if (value === "Problema") {
    classes =
      "border-red-500/40 bg-red-500/10 text-red-300";
  }

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {value}
    </span>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: TaskPriority;
}) {
  let classes =
    "border-zinc-500/40 bg-zinc-500/10 text-zinc-300";

  if (priority === "Alta") {
    classes =
      "border-orange-500/40 bg-orange-500/10 text-orange-300";
  }

  if (priority === "Urgente") {
    classes =
      "border-red-500/40 bg-red-500/10 text-red-300";
  }

  if (priority === "Baixa") {
    classes =
      "border-blue-500/40 bg-blue-500/10 text-blue-300";
  }

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      Prioridade: {priority}
    </span>
  );
}

function SmallBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-400">
      {children}
    </span>
  );
}

function ActionButton({
  onClick,
  children,
  success = false,
  danger = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  success?: boolean;
  danger?: boolean;
}) {
  let classes =
    "border-zinc-600 bg-zinc-900 text-zinc-300 hover:border-zinc-400 hover:text-white";

  if (success) {
    classes =
      "border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500 hover:text-black";
  }

  if (danger) {
    classes =
      "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500 hover:text-white";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${classes}`}
    >
      {children}
    </button>
  );
}

function EmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-5 py-10 text-center">
      <p className="text-sm text-zinc-500">
        {message}
      </p>
    </div>
  );
}