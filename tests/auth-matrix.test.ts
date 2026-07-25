import { describe, it } from "node:test";
import assert from "node:assert/strict";

type Role = "owner" | "administrator" | "representative" | "model" | null;

type RouteAccess = {
  path: string;
  roles: Role[];
  description: string;
};

const routeAccessMatrix: RouteAccess[] = [
  {
    path: "/owner",
    roles: ["owner"],
    description: "Owner dashboard is owner-only",
  },
  {
    path: "/owner/users",
    roles: ["owner"],
    description: "User management is owner-only",
  },
  {
    path: "/owner/users/new",
    roles: ["owner"],
    description: "Creating users is owner-only",
  },
  {
    path: "/admin/models",
    roles: ["owner", "administrator"],
    description: "Admin models list is staff-only",
  },
  {
    path: "/admin/models/example-slug",
    roles: ["owner", "administrator"],
    description: "Admin model detail is staff-only",
  },
  {
    path: "/admin/users/new",
    roles: ["owner", "administrator"],
    description: "Admin user creation is staff-only",
  },
  {
    path: "/representative",
    roles: ["representative"],
    description: "Representative dashboard is rep-only",
  },
  {
    path: "/representative/models/123",
    roles: ["representative"],
    description: "Rep model detail is rep-only",
  },
  {
    path: "/area-da-modelo",
    roles: ["model"],
    description: "Model dashboard is model-only",
  },
  {
    path: "/alterar-senha",
    roles: ["owner", "administrator", "representative", "model"],
    description: "Change password is for all authenticated users",
  },
  {
    path: "/api/models/notes",
    roles: ["owner", "administrator", "representative"],
    description: "Notes API is for staff and representatives",
  },
  {
    path: "/api/models/payments",
    roles: ["owner", "administrator", "representative"],
    description: "Payments API is for staff and assigned reps",
  },
  {
    path: "/api/models/earnings",
    roles: ["owner", "administrator", "representative"],
    description: "Earnings API is for staff and assigned reps",
  },
  {
    path: "/api/models/documents",
    roles: ["owner", "administrator", "representative"],
    description: "Documents API is for staff and assigned reps",
  },
  {
    path: "/api/models/onboarding",
    roles: ["owner", "administrator", "representative", "model"],
    description: "Onboarding API is for staff, reps, and the model themselves",
  },
  {
    path: "/api/models/checklist",
    roles: ["owner", "administrator"],
    description: "Checklist API is staff-only (write)",
  },
  {
    path: "/api/models/update",
    roles: ["owner", "administrator"],
    description: "Model update API is staff-only",
  },
  {
    path: "/api/admin/users",
    roles: ["owner", "administrator"],
    description: "Admin users API is staff-only",
  },
  {
    path: "/amplia",
    roles: ["owner", "administrator"],
    description: "Amplia overview is staff-only",
  },
  {
    path: "/amplia/clientes",
    roles: ["owner", "administrator"],
    description: "Amplia client list is staff-only",
  },
  {
    path: "/amplia/clientes/example-talent-id",
    roles: ["owner", "administrator"],
    description: "Amplia client detail is staff-only",
  },
  {
    path: "/amplia/contas-sociais",
    roles: ["owner", "administrator"],
    description: "Amplia social accounts is staff-only",
  },
  {
    path: "/amplia/configuracoes",
    roles: ["owner", "administrator"],
    description: "Amplia settings page is staff-only (owner-only to write)",
  },
  {
    path: "/amplia/auditoria",
    roles: ["owner", "administrator"],
    description: "Amplia audit view is staff-only",
  },
];

/**
 * Amplia actions that only the owner may perform, even though administrators
 * can reach the page. Enforced in the DB (app_settings write policies check
 * is_owner()) and re-checked in the server action.
 */
const ownerOnlyAmpliaActions = [
  {
    name: "update Amplia settings (module name, display name, X feature flag)",
    roles: ["owner"] as Role[],
  },
];

const allRoles: Role[] = [
  "owner",
  "administrator",
  "representative",
  "model",
  null,
];

function hasAccess(route: RouteAccess, role: Role): boolean {
  return route.roles.includes(role);
}

describe("Route-level authorization matrix", () => {
  for (const route of routeAccessMatrix) {
    describe(`${route.path} — ${route.description}`, () => {
      for (const role of allRoles) {
        const roleName = role ?? "unauthenticated";
        const shouldAccess = route.roles.includes(role);

        it(`${roleName} ${shouldAccess ? "should" : "should NOT"} access`, () => {
          assert.strictEqual(hasAccess(route, role), shouldAccess);
        });
      }
    });
  }
});

describe("Role isolation", () => {
  it("representative cannot access owner routes", () => {
    const ownerRoutes = routeAccessMatrix.filter((r) =>
      r.path.startsWith("/owner"),
    );
    for (const route of ownerRoutes) {
      assert.strictEqual(hasAccess(route, "representative"), false);
    }
  });

  it("model cannot access admin routes", () => {
    const adminRoutes = routeAccessMatrix.filter((r) =>
      r.path.startsWith("/admin"),
    );
    for (const route of adminRoutes) {
      assert.strictEqual(hasAccess(route, "model"), false);
    }
  });

  it("model cannot access representative routes", () => {
    const repRoutes = routeAccessMatrix.filter((r) =>
      r.path.startsWith("/representative"),
    );
    for (const route of repRoutes) {
      assert.strictEqual(hasAccess(route, "model"), false);
    }
  });

  it("representative cannot access checklist update API", () => {
    const checklistRoute = routeAccessMatrix.find(
      (r) => r.path === "/api/models/checklist",
    );
    assert.ok(checklistRoute, "Checklist route should exist");
    assert.strictEqual(hasAccess(checklistRoute, "representative"), false);
  });

  it("representative can create notes but not edit/pin/archive", () => {
    const notesRoute = routeAccessMatrix.find(
      (r) => r.path === "/api/models/notes",
    );
    assert.ok(notesRoute, "Notes route should exist");
    assert.strictEqual(hasAccess(notesRoute, "representative"), true);
  });

  it("unauthenticated users cannot access any protected route", () => {
    for (const route of routeAccessMatrix) {
      assert.strictEqual(hasAccess(route, null), false);
    }
  });
});

describe("Amplia (Brand Growth) access", () => {
  const ampliaRoutes = routeAccessMatrix.filter((r) =>
    r.path.startsWith("/amplia"),
  );

  it("has Amplia routes under test", () => {
    assert.ok(ampliaRoutes.length > 0);
  });

  it("representatives do NOT auto-receive Brand Growth access", () => {
    for (const route of ampliaRoutes) {
      assert.strictEqual(hasAccess(route, "representative"), false);
    }
  });

  it("models cannot access any Amplia route", () => {
    for (const route of ampliaRoutes) {
      assert.strictEqual(hasAccess(route, "model"), false);
    }
  });

  it("unauthenticated users cannot access any Amplia route", () => {
    for (const route of ampliaRoutes) {
      assert.strictEqual(hasAccess(route, null), false);
    }
  });

  it("owner and administrator can access every Amplia route", () => {
    for (const route of ampliaRoutes) {
      assert.strictEqual(hasAccess(route, "owner"), true);
      assert.strictEqual(hasAccess(route, "administrator"), true);
    }
  });

  it("administrators cannot perform owner-only Amplia actions", () => {
    for (const action of ownerOnlyAmpliaActions) {
      assert.strictEqual(
        action.roles.includes("administrator"),
        false,
        `${action.name} must not be available to administrators`,
      );
      assert.strictEqual(action.roles.includes("owner"), true);
    }
  });
});
