import { describe, expect, test, vi } from "vitest";

import { cleanupAnonymousUsers } from "./crons";
import { deleteAllStatements, addStatement } from "./invoices";
import { replaceManualTransactions } from "./manualTransactions";
import { getMergedTransactionsFromNormalized } from "./normalizedMonthStore";

const USER_ID = "users:authenticated";

const csvColumns = [
  "Started Date",
  "Completed Date",
  "ID",
  "Type",
  "State",
  "Description",
  "Reference",
  "Payer",
  "Card Number",
  "Card Label",
  "Card State",
  "Orig Currency",
  "Orig Amount",
  "Payment Currency",
  "Amount",
  "Total Amount",
  "Exchange Rate",
  "Fee",
  "Fee Currency",
  "Balance",
  "Account",
  "Beneficiary Account Number",
  "Beneficiary Sort Code",
  "Beneficiary IBAN",
  "Beneficiary BIC",
  "MCC",
  "Related Transaction ID",
  "Spend Program",
] as const;

type Row = Record<string, unknown> & { _id: string; _creationTime: number };
type TableSeed = Record<
  string,
  Array<Record<string, unknown> & { _id: string }>
>;

type IndexBuilder = {
  eq(field: string, value: unknown): IndexBuilder;
};

type ConvexFunctionForTest = {
  _handler(ctx: never, args: Record<string, unknown>): Promise<unknown>;
};

const addStatementForTest = addStatement as unknown as ConvexFunctionForTest;
const cleanupAnonymousUsersForTest =
  cleanupAnonymousUsers as unknown as ConvexFunctionForTest;
const deleteAllStatementsForTest =
  deleteAllStatements as unknown as ConvexFunctionForTest;
const replaceManualTransactionsForTest =
  replaceManualTransactions as unknown as ConvexFunctionForTest;

class FakeQuery {
  constructor(private readonly rows: Row[]) {}

  withIndex(_name: string, buildRange: (q: IndexBuilder) => unknown) {
    const constraints: Array<{ field: string; value: unknown }> = [];
    const builder: IndexBuilder = {
      eq(field, value) {
        constraints.push({ field, value });
        return builder;
      },
    };

    buildRange(builder);

    return new FakeQuery(
      this.rows.filter((row) =>
        constraints.every(({ field, value }) => Object.is(row[field], value)),
      ),
    );
  }

  order(direction: "asc" | "desc") {
    return new FakeQuery(
      [...this.rows].sort((a, b) =>
        direction === "asc"
          ? a._creationTime - b._creationTime
          : b._creationTime - a._creationTime,
      ),
    );
  }

  async collect() {
    return [...this.rows];
  }

  async take(limit: number) {
    return this.rows.slice(0, limit);
  }

  async first() {
    return this.rows[0] ?? null;
  }

  async unique() {
    if (this.rows.length > 1) {
      throw new Error("Expected unique query result");
    }
    return this.rows[0] ?? null;
  }
}

class FakeDb {
  private readonly tables = new Map<string, Row[]>();
  private readonly counters = new Map<string, number>();

  constructor(seed: TableSeed = {}) {
    for (const [table, rows] of Object.entries(seed)) {
      this.tables.set(
        table,
        rows.map((row, index) => ({ _creationTime: index + 1, ...row })),
      );
    }
  }

  table(tableName: string) {
    return this.rows(tableName);
  }

  query(tableName: string) {
    return new FakeQuery(this.rows(tableName));
  }

  async get(id: string) {
    const tableName = tableFromId(id);
    return this.rows(tableName).find((row) => row._id === id) ?? null;
  }

  async insert(tableName: string, value: Record<string, unknown>) {
    const next = (this.counters.get(tableName) ?? 0) + 1;
    this.counters.set(tableName, next);
    const row = {
      _id: `${tableName}:${next}`,
      _creationTime: next,
      ...value,
    };
    this.rows(tableName).push(row);
    return row._id;
  }

  async patch(id: string, value: Record<string, unknown>) {
    const tableName = tableFromId(id);
    const row = this.rows(tableName).find((candidate) => candidate._id === id);
    if (!row) {
      throw new Error(`No row for id ${id}`);
    }
    Object.assign(row, value);
  }

  async delete(id: string) {
    const tableName = tableFromId(id);
    const rows = this.rows(tableName);
    const index = rows.findIndex((row) => row._id === id);
    if (index !== -1) {
      rows.splice(index, 1);
    }
  }

  private rows(tableName: string) {
    let rows = this.tables.get(tableName);
    if (!rows) {
      rows = [];
      this.tables.set(tableName, rows);
    }
    return rows;
  }
}

function tableFromId(id: string) {
  return id.slice(0, id.indexOf(":"));
}

function createCtx(db = new FakeDb(), userId = USER_ID) {
  const deletedStorageIds: string[] = [];

  return {
    auth: {
      async getUserIdentity() {
        return { subject: `${userId}|session` };
      },
    },
    db,
    storage: {
      deletedStorageIds,
      async delete(storageId: string) {
        deletedStorageIds.push(storageId);
      },
      async getUrl(storageId: string) {
        return `https://storage.example/${storageId}`;
      },
      async generateUploadUrl() {
        return "https://upload.example";
      },
    },
    scheduler: {
      async runAfter() {},
    },
  };
}

function authenticatedUser(id = USER_ID) {
  return { _id: id, isAnonymous: false };
}

function statementTransaction(overrides: Record<string, string> = {}) {
  return {
    id: "csv-tx-1",
    dateStarted: "2026-03-10 10:00:00",
    dateCompleted: "2026-03-10 10:00:03",
    type: "CARD_PAYMENT",
    state: "COMPLETED",
    description: "Statement Vendor",
    reference: "ref-1",
    payer: "",
    cardNumber: "1234",
    cardLabel: "Main",
    cardState: "ACTIVE",
    origCurrency: "EUR",
    origAmount: "-42.15",
    paymentCurrency: "EUR",
    amount: "-42.15",
    totalAmount: "-42.15",
    exchangeRate: "",
    fee: "0",
    feeCurrency: "EUR",
    balance: "1000",
    account: "Primary",
    beneficiaryAccountNumber: "",
    beneficiarySortCode: "",
    beneficiaryIban: "",
    beneficiaryBic: "",
    mcc: "5734",
    relatedTransactionId: "",
    spendProgram: "",
    ...overrides,
  };
}

function revolutCsv(rowOverrides: Record<string, string> = {}) {
  const row = statementTransaction(rowOverrides);
  const valuesByColumn: Record<(typeof csvColumns)[number], string> = {
    "Started Date": row.dateStarted,
    "Completed Date": row.dateCompleted,
    ID: row.id,
    Type: row.type,
    State: row.state,
    Description: row.description,
    Reference: row.reference,
    Payer: row.payer,
    "Card Number": row.cardNumber,
    "Card Label": row.cardLabel,
    "Card State": row.cardState,
    "Orig Currency": row.origCurrency,
    "Orig Amount": row.origAmount,
    "Payment Currency": row.paymentCurrency,
    Amount: row.amount,
    "Total Amount": row.totalAmount,
    "Exchange Rate": row.exchangeRate,
    Fee: row.fee,
    "Fee Currency": row.feeCurrency,
    Balance: row.balance,
    Account: row.account,
    "Beneficiary Account Number": row.beneficiaryAccountNumber,
    "Beneficiary Sort Code": row.beneficiarySortCode,
    "Beneficiary IBAN": row.beneficiaryIban,
    "Beneficiary BIC": row.beneficiaryBic,
    MCC: row.mcc,
    "Related Transaction ID": row.relatedTransactionId,
    "Spend Program": row.spendProgram,
  };

  return [
    csvColumns.join(","),
    csvColumns.map((column) => valuesByColumn[column]).join(","),
  ].join("\n");
}

describe("backend transaction behavior", () => {
  test("manual merged transaction ids stay stable when an existing row is edited", async () => {
    const db = new FakeDb({ users: [authenticatedUser()] });
    const ctx = createCtx(db);

    await replaceManualTransactionsForTest._handler(ctx as never, {
      transactions: [
        {
          monthKey: "2026-03",
          name: "VAT payment",
          amount: "10.00",
          currency: "eur",
          recurring: false,
        },
      ],
    });

    const [createdRow] = db.table("manualTransactions");
    const [createdMerged] = await getMergedTransactionsFromNormalized(
      ctx as never,
      USER_ID as never,
      "2026-03",
    );

    await replaceManualTransactionsForTest._handler(ctx as never, {
      transactions: [
        {
          id: createdRow._id,
          monthKey: "2026-03",
          name: "Edited VAT payment",
          amount: "12.50",
          currency: "eur",
          recurring: false,
        },
      ],
    });

    const [editedRow] = db.table("manualTransactions");
    const [editedMerged] = await getMergedTransactionsFromNormalized(
      ctx as never,
      USER_ID as never,
      "2026-03",
    );

    expect(editedRow._id).toBe(createdRow._id);
    expect(editedMerged).toMatchObject({
      id: createdMerged.id,
      description: "Edited VAT payment",
      amount: "12.50",
      origCurrency: "EUR",
      sourceFile: "Manual",
    });
  });

  test("recurring manual rows are merged into every requested month", async () => {
    const db = new FakeDb({ users: [authenticatedUser()] });
    const ctx = createCtx(db);

    await replaceManualTransactionsForTest._handler(ctx as never, {
      transactions: [
        {
          name: "Monthly bank fee",
          amount: "9.00",
          currency: "EUR",
          recurring: true,
        },
        {
          monthKey: "2026-03",
          name: "March-only tax",
          amount: "40.00",
          currency: "EUR",
          recurring: false,
        },
        {
          monthKey: "2026-04",
          name: "April-only tax",
          amount: "50.00",
          currency: "EUR",
          recurring: false,
        },
      ],
    });

    const marchDescriptions = (
      await getMergedTransactionsFromNormalized(
        ctx as never,
        USER_ID as never,
        "2026-03",
      )
    ).map((transaction) => transaction.description);
    const aprilDescriptions = (
      await getMergedTransactionsFromNormalized(
        ctx as never,
        USER_ID as never,
        "2026-04",
      )
    ).map((transaction) => transaction.description);

    expect(marchDescriptions).toEqual(["Monthly bank fee", "March-only tax"]);
    expect(aprilDescriptions).toEqual(["Monthly bank fee", "April-only tax"]);
  });

  test("CSV statement rows are persisted in statementTransactions and read back into merged transactions", async () => {
    const db = new FakeDb({ users: [authenticatedUser()] });
    const ctx = createCtx(db);

    await addStatementForTest._handler(ctx as never, {
      monthKey: "2026-03",
      storageId: "_storage:statement-csv",
      fileName: "revolut.csv",
      fileType: "csv",
      csvContent: revolutCsv({ id: "csv-tx-42", amount: "-42.15" }),
      fileHash: "hash-1",
    });

    const [statement] = db.table("statements");
    const statementRows = db.table("statementTransactions");
    const merged = await getMergedTransactionsFromNormalized(
      ctx as never,
      USER_ID as never,
      "2026-03",
    );

    expect(statement).not.toHaveProperty("transactions");
    expect(statementRows).toHaveLength(1);
    expect(statementRows[0]).toMatchObject({
      userId: USER_ID,
      monthKey: "2026-03",
      statementId: statement.statementId,
      transactionId: "csv-tx-42",
      transaction: expect.objectContaining({
        id: "csv-tx-42",
        amount: "-42.15",
      }),
    });
    expect(merged).toEqual([
      expect.objectContaining({
        id: "csv-tx-42",
        sourceFile: "revolut.csv",
        amount: "-42.15",
      }),
    ]);
  });

  test("deleteAllStatements removes statement rows and bindings without removing manual bindings", async () => {
    const db = new FakeDb({
      users: [authenticatedUser()],
      statements: [
        {
          _id: "statements:statement-1",
          userId: USER_ID,
          monthKey: "2026-03",
          statementId: "stmt-1",
          storageId: "_storage:stmt-1",
          fileName: "revolut.csv",
          fileType: "csv",
          uploadedAt: 1,
        },
      ],
      statementTransactions: [
        {
          _id: "statementTransactions:row-1",
          userId: USER_ID,
          monthKey: "2026-03",
          statementId: "stmt-1",
          transactionId: "csv-tx-1",
          transaction: statementTransaction({ id: "csv-tx-1" }),
          createdAt: 1,
        },
      ],
      manualTransactions: [
        {
          _id: "manualTransactions:row-1",
          userId: USER_ID,
          monthKey: "2026-03",
          name: "Manual tax",
          amount: "30.00",
          currency: "EUR",
          recurring: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      transactionInvoiceBindings: [
        {
          _id: "transactionInvoiceBindings:statement-binding",
          userId: USER_ID,
          monthKey: "2026-03",
          transactionId: "csv-tx-1",
          invoiceStorageId: "NOT_NEEDED",
          boundAt: 1,
        },
        {
          _id: "transactionInvoiceBindings:manual-binding",
          userId: USER_ID,
          monthKey: "2026-03",
          transactionId: "manual_transaction_manualTransactions:row-1",
          invoiceStorageId: "NOT_NEEDED",
          boundAt: 2,
        },
      ],
    });
    const ctx = createCtx(db);

    await deleteAllStatementsForTest._handler(ctx as never, {
      monthKey: "2026-03",
    });

    expect(db.table("statements")).toEqual([]);
    expect(db.table("statementTransactions")).toEqual([]);
    expect(db.table("transactionInvoiceBindings")).toEqual([
      expect.objectContaining({
        _id: "transactionInvoiceBindings:manual-binding",
        transactionId: "manual_transaction_manualTransactions:row-1",
      }),
    ]);
    expect(ctx.storage.deletedStorageIds).toEqual(["_storage:stmt-1"]);
  });

  test("anonymous cleanup deletes only expired anonymous users and all of their backend data", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(100_000);
    const oldAnonymousId = "users:old-anonymous";
    const newAnonymousId = "users:new-anonymous";
    const passwordUserId = "users:password";
    const db = new FakeDb({
      users: [
        { _id: oldAnonymousId, isAnonymous: true, _creationTime: 80_000 },
        { _id: newAnonymousId, isAnonymous: true, _creationTime: 95_000 },
        { _id: passwordUserId, isAnonymous: false, _creationTime: 1 },
      ],
      incomingInvoices: [
        {
          _id: "incomingInvoices:old",
          userId: oldAnonymousId,
          monthKey: "2026-03",
          invoiceId: "inv-old",
          storageId: "_storage:invoice-old",
          fileName: "old.pdf",
          uploadedAt: 1,
          analysis: {},
          parsing: {},
        },
        {
          _id: "incomingInvoices:retained",
          userId: newAnonymousId,
          monthKey: "2026-03",
          invoiceId: "inv-retained",
          storageId: "_storage:invoice-retained",
          fileName: "retained.pdf",
          uploadedAt: 1,
          analysis: {},
          parsing: {},
        },
      ],
      statements: [
        {
          _id: "statements:old",
          userId: oldAnonymousId,
          monthKey: "2026-03",
          statementId: "stmt-old",
          storageId: "_storage:statement-old",
          fileName: "old.csv",
          fileType: "csv",
          uploadedAt: 1,
        },
      ],
      statementTransactions: [
        {
          _id: "statementTransactions:old",
          userId: oldAnonymousId,
          monthKey: "2026-03",
          statementId: "stmt-old",
          transactionId: "csv-old",
          transaction: statementTransaction({ id: "csv-old" }),
          createdAt: 1,
        },
      ],
      manualTransactions: [
        {
          _id: "manualTransactions:old",
          userId: oldAnonymousId,
          monthKey: "2026-03",
          name: "Old manual",
          amount: "1.00",
          recurring: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      transactionInvoiceBindings: [
        {
          _id: "transactionInvoiceBindings:old",
          userId: oldAnonymousId,
          monthKey: "2026-03",
          transactionId: "csv-old",
          invoiceStorageId: "NOT_NEEDED",
          boundAt: 1,
        },
      ],
      userSettings: [
        {
          _id: "userSettings:old",
          userId: oldAnonymousId,
          vatId: "ATU12345678",
          updatedAt: 1,
        },
      ],
    });
    const ctx = createCtx(db, oldAnonymousId);

    try {
      await expect(
        cleanupAnonymousUsersForTest._handler(ctx as never, {
          olderThanMs: 10_000,
          limit: 10,
        }),
      ).resolves.toEqual({ deletedUsers: 1 });
    } finally {
      now.mockRestore();
    }

    expect(db.table("users").map((user) => user._id)).toEqual([
      newAnonymousId,
      passwordUserId,
    ]);
    expect(db.table("incomingInvoices")).toEqual([
      expect.objectContaining({ _id: "incomingInvoices:retained" }),
    ]);
    expect(db.table("statements")).toEqual([]);
    expect(db.table("statementTransactions")).toEqual([]);
    expect(db.table("manualTransactions")).toEqual([]);
    expect(db.table("transactionInvoiceBindings")).toEqual([]);
    expect(db.table("userSettings")).toEqual([]);
    expect(ctx.storage.deletedStorageIds).toEqual([
      "_storage:invoice-old",
      "_storage:statement-old",
    ]);
  });
});
