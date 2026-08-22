import { PrismaClient, TaskPriority, TaskStatus } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Development-only credentials. Never use these values (or this pattern) in
// a real deployment — see README "Demo credentials" for the full list.
const DEMO_PASSWORD = "DemoPass123!";

async function main() {
  console.log("Seeding TaskFlow demo data...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // ---- Organization A: Nimbus Logistics -----------------------------------
  const orgA = await prisma.organization.create({ data: { name: "Nimbus Logistics" } });

  const orgAAdmin = await prisma.user.create({
    data: { email: "admin@nimbus.example", passwordHash, fullName: "Priya Sharma" },
  });
  const orgAMember1 = await prisma.user.create({
    data: { email: "member@nimbus.example", passwordHash, fullName: "Raj Patel" },
  });
  const orgAMember2 = await prisma.user.create({
    data: { email: "dev@nimbus.example", passwordHash, fullName: "Ananya Iyer" },
  });

  await prisma.orgMember.createMany({
    data: [
      { organizationId: orgA.id, userId: orgAAdmin.id, role: "org_admin" },
      { organizationId: orgA.id, userId: orgAMember1.id, role: "member" },
      { organizationId: orgA.id, userId: orgAMember2.id, role: "member" },
    ],
  });

  const orgAProject1 = await prisma.project.create({
    data: {
      organizationId: orgA.id,
      name: "Carrier Onboarding Portal",
      description: "Self-serve portal for onboarding new freight carriers.",
    },
  });
  const orgAProject2 = await prisma.project.create({
    data: {
      organizationId: orgA.id,
      name: "Warehouse Inventory Sync",
      description: "Real-time inventory sync between warehouses and the ERP.",
    },
  });

  const orgATasksData: Array<{
    projectId: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate?: Date;
  }> = [
    { projectId: orgAProject1.id, title: "Design onboarding wizard UI", description: "Multi-step form for new carrier signup.", status: "in_progress", priority: "high", dueDate: new Date("2026-09-01") },
    { projectId: orgAProject1.id, title: "Integrate DOT number verification", description: "Call the FMCSA API to verify carrier DOT numbers.", status: "todo", priority: "urgent", dueDate: new Date("2026-08-28") },
    { projectId: orgAProject1.id, title: "Write onboarding API docs", description: "Document the public onboarding endpoints.", status: "todo", priority: "low" },
    { projectId: orgAProject1.id, title: "Add e-signature step", description: "Integrate DocuSign for the carrier agreement.", status: "review", priority: "medium", dueDate: new Date("2026-09-10") },
    { projectId: orgAProject1.id, title: "QA onboarding flow end-to-end", description: "Full regression pass before launch.", status: "todo", priority: "high" },
    { projectId: orgAProject1.id, title: "Ship onboarding portal v1", description: "Deploy to production.", status: "done", priority: "urgent" },
    { projectId: orgAProject2.id, title: "Build inventory delta reconciliation job", description: "Nightly job comparing warehouse counts to ERP records.", status: "in_progress", priority: "high", dueDate: new Date("2026-09-05") },
    { projectId: orgAProject2.id, title: "Add low-stock alerting", description: "Notify ops when SKU inventory drops below threshold.", status: "todo", priority: "medium" },
    { projectId: orgAProject2.id, title: "Migrate legacy inventory table", description: "Backfill historical records into the new schema.", status: "review", priority: "medium" },
    { projectId: orgAProject2.id, title: "Load test sync pipeline", description: "Verify the pipeline holds up under peak warehouse traffic.", status: "todo", priority: "low" },
    { projectId: orgAProject2.id, title: "Fix duplicate SKU bug", description: "Duplicate rows appearing after concurrent sync runs.", status: "done", priority: "urgent" },
  ];

  const orgATasks = [];
  for (const t of orgATasksData) {
    orgATasks.push(await prisma.task.create({ data: t }));
  }

  await prisma.taskAssignment.createMany({
    data: [
      { taskId: orgATasks[0].id, userId: orgAMember2.id },
      { taskId: orgATasks[1].id, userId: orgAMember1.id },
      { taskId: orgATasks[6].id, userId: orgAMember2.id },
      { taskId: orgATasks[7].id, userId: orgAMember1.id },
    ],
  });

  await prisma.comment.createMany({
    data: [
      { taskId: orgATasks[0].id, authorId: orgAAdmin.id, body: "Let's use the design system's stepper component for this." },
      { taskId: orgATasks[0].id, authorId: orgAMember2.id, body: "Agreed — first draft is up in Figma." },
      { taskId: orgATasks[6].id, authorId: orgAMember1.id, body: "Reconciliation job is passing in staging, running load tests next." },
    ],
  });

  // ---- Organization B: Solace Retail Group --------------------------------
  const orgB = await prisma.organization.create({ data: { name: "Solace Retail Group" } });

  const orgBAdmin = await prisma.user.create({
    data: { email: "admin@solace.example", passwordHash, fullName: "Miguel Torres" },
  });
  const orgBMember1 = await prisma.user.create({
    data: { email: "member@solace.example", passwordHash, fullName: "Hannah Lee" },
  });

  await prisma.orgMember.createMany({
    data: [
      { organizationId: orgB.id, userId: orgBAdmin.id, role: "org_admin" },
      { organizationId: orgB.id, userId: orgBMember1.id, role: "member" },
    ],
  });

  const orgBProject1 = await prisma.project.create({
    data: {
      organizationId: orgB.id,
      name: "Storefront Checkout Revamp",
      description: "Redesign of the checkout flow to reduce cart abandonment.",
    },
  });

  const orgBTasksData: Array<{
    projectId: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate?: Date;
  }> = [
    { projectId: orgBProject1.id, title: "Redesign cart summary component", description: "Show shipping estimate inline.", status: "in_progress", priority: "high", dueDate: new Date("2026-09-03") },
    { projectId: orgBProject1.id, title: "Add saved payment methods", description: "Let returning customers reuse a stored card.", status: "todo", priority: "medium" },
    { projectId: orgBProject1.id, title: "A/B test one-page vs multi-step checkout", description: "Set up the experiment and success metrics.", status: "todo", priority: "high" },
    { projectId: orgBProject1.id, title: "Fix promo code validation bug", description: "Codes with trailing whitespace are rejected incorrectly.", status: "done", priority: "urgent" },
  ];

  const orgBTasks = [];
  for (const t of orgBTasksData) {
    orgBTasks.push(await prisma.task.create({ data: t }));
  }

  await prisma.taskAssignment.create({
    data: { taskId: orgBTasks[0].id, userId: orgBMember1.id },
  });

  await prisma.comment.create({
    data: { taskId: orgBTasks[0].id, authorId: orgBAdmin.id, body: "Let's ship the shipping estimate first, hold the rest for v2." },
  });

  console.log("Seed complete.");
  console.log("");
  console.log("Organization A — Nimbus Logistics");
  console.log(`  admin:  admin@nimbus.example / ${DEMO_PASSWORD}`);
  console.log(`  member: member@nimbus.example / ${DEMO_PASSWORD}`);
  console.log("Organization B — Solace Retail Group");
  console.log(`  admin:  admin@solace.example / ${DEMO_PASSWORD}`);
  console.log(`  member: member@solace.example / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
