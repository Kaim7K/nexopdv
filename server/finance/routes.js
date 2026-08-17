import { AppError } from '../errors.js';
import { methodNotAllowed, send } from '../http.js';
import {
  cancelPurchase,
  cancelTransaction,
  confirmPurchase,
  createPurchase,
  createTransaction,
  duplicateTransaction,
  ensureFinanceMaintenance,
  financePermissions,
  invalidateFinanceMaintenance,
  listPurchases,
  listTransactions,
  loadBootstrap,
  loadDashboard,
  loadHistory,
  loadLedger,
  loadPurchaseProducts,
  loadReceivables,
  loadReconciliation,
  payTransaction,
  referenceList,
  requirePermission,
  round,
  saveAccount,
  saveCategory,
  saveGoal,
  saveRecurring,
  saveSettings,
  saveSupplier,
  saveUserPermissions,
  transactionDetail,
  updateTransaction,
  validUuid,
} from '../finance.js';

export async function handleFinanceRequest({ req, res, sql, user, path }) {
  if (!user.market_id)
    return send(res, 400, { message: "Usuário sem mercadinho vinculado." });
  const section = path[1] || "dashboard",
    id = path[2],
    action = path[3];
  await ensureFinanceMaintenance(sql, user);
  const permissions = await financePermissions(sql, user);
  requirePermission(permissions, "view");

  if (section === "bootstrap" && req.method === "GET")
    return send(res, 200, await loadBootstrap(sql, user, permissions));
  if (section === "dashboard" && req.method === "GET") {
    const dashboard = await loadDashboard(sql, user.market_id, req.query);
    if (!permissions.view_profit) {
      delete dashboard.summary.estimated_profit;
      delete dashboard.summary.margin;
      delete dashboard.dre;
      delete dashboard.goals;
      dashboard.series.forEach((item) => {
        Reflect.deleteProperty(item, "profit");
      });
    }
    if (!permissions.view_costs) {
      delete dashboard.summary.cogs;
      delete dashboard.summary.inventory_value;
      dashboard.top_products = dashboard.top_products.map(
        ({ cost, profit, ...item }) => item,
      );
      dashboard.top_categories = dashboard.top_categories.map(
        ({ cost, profit, ...item }) => item,
      );
    }
    return send(res, 200, dashboard);
  }
  if (section === "ledger" && req.method === "GET")
    return send(res, 200, await loadLedger(sql, user.market_id, req.query));
  if (section === "receivables" && req.method === "GET")
    return send(
      res,
      200,
      await loadReceivables(sql, user.market_id, req.query),
    );
  if (section === "reconciliation" && req.method === "GET")
    return send(
      res,
      200,
      await loadReconciliation(sql, user.market_id, req.query),
    );
  if (section === "history" && req.method === "GET")
    return send(res, 200, await loadHistory(sql, user.market_id, req.query));
  if (section === "products" && req.method === "GET") {
    if (!(user.enabled_features || []).includes("integrated_purchases"))
      throw new AppError(
        403,
        "FEATURE_NOT_AVAILABLE",
        "Compras integradas ao estoque não estão incluídas neste plano.",
      );
    requirePermission(permissions, "manage_purchases");
    return send(res, 200, await loadPurchaseProducts(sql, user.market_id));
  }

  if (section === "transactions") {
    if (!id && req.method === "GET")
      return send(
        res,
        200,
        await listTransactions(sql, user.market_id, req.query),
      );
    if (!id && req.method === "POST") {
      requirePermission(permissions, "create");
      return send(res, 201, await createTransaction(sql, user, req.body || {}));
    }
    if (id && id !== "batch" && !action && req.method === "GET")
      return send(res, 200, await transactionDetail(sql, user.market_id, id));
    if (id && req.method === "PATCH") {
      requirePermission(permissions, "edit");
      return send(
        res,
        200,
        await updateTransaction(sql, user, id, req.body || {}),
      );
    }
    if (id && action === "pay" && req.method === "POST") {
      requirePermission(permissions, "pay");
      return send(
        res,
        200,
        await payTransaction(sql, user, id, req.body || {}),
      );
    }
    if (id && action === "cancel" && req.method === "POST") {
      requirePermission(permissions, "cancel");
      return send(
        res,
        200,
        await cancelTransaction(sql, user, id, req.body?.reason),
      );
    }
    if (id && action === "duplicate" && req.method === "POST") {
      requirePermission(permissions, "create");
      return send(res, 201, await duplicateTransaction(sql, user, id));
    }
    if (id === "batch" && req.method === "POST") {
      const ids = Array.isArray(req.body.ids)
        ? [...new Set(req.body.ids.filter(validUuid))].slice(0, 100)
        : [];
      if (!ids.length)
        throw new AppError(
          400,
          "BATCH_EMPTY",
          "Selecione ao menos um lançamento.",
        );
      if (req.body.action === "cancel") {
        requirePermission(permissions, "cancel");
        const results = [];
        for (const transactionId of ids)
          results.push(
            await cancelTransaction(sql, user, transactionId, req.body.reason),
          );
        return send(res, 200, { items: results });
      }
      if (req.body.action === "pay") {
        requirePermission(permissions, "pay");
        const results = [];
        for (const transactionId of ids) {
          const detail = await transactionDetail(
            sql,
            user.market_id,
            transactionId,
          );
          const remaining = round(detail.amount - detail.paid_amount);
          if (
            remaining > 0 &&
            ["pending", "partial", "overdue"].includes(detail.status)
          )
            results.push(
              await payTransaction(sql, user, transactionId, {
                ...req.body,
                amount: remaining,
              }),
            );
        }
        return send(res, 200, { items: results });
      }
      throw new AppError(400, "INVALID_BATCH_ACTION", "Ação em lote inválida.");
    }
    return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
  }

  if (section === "categories") {
    if (req.method === "GET")
      return send(
        res,
        200,
        await referenceList(sql, "finance_categories", user.market_id),
      );
    requirePermission(permissions, "manage_settings");
    if (!id && req.method === "POST")
      return send(
        res,
        201,
        await saveCategory(sql, user, null, req.body || {}),
      );
    if (id && req.method === "PATCH")
      return send(res, 200, await saveCategory(sql, user, id, req.body || {}));
    if (id && req.method === "DELETE") {
      if (!validUuid(id))
        throw new AppError(400, "INVALID_CATEGORY", "Categoria inválida.");
      const [row] =
        await sql`UPDATE nexo.finance_categories SET active=false,updated_date=now() WHERE id=${id} AND market_id=${user.market_id} AND system_key IS NULL RETURNING *`;
      if (!row)
        throw new AppError(
          404,
          "CATEGORY_NOT_EDITABLE",
          "Categoria não encontrada ou protegida.",
        );
      return send(res, 200, row);
    }
  }
  if (section === "suppliers") {
    if (req.method === "GET")
      return send(
        res,
        200,
        await referenceList(sql, "finance_suppliers", user.market_id),
      );
    requirePermission(permissions, "manage_suppliers");
    if (!id && req.method === "POST")
      return send(
        res,
        201,
        await saveSupplier(sql, user, null, req.body || {}),
      );
    if (id && req.method === "PATCH")
      return send(res, 200, await saveSupplier(sql, user, id, req.body || {}));
    if (id && req.method === "DELETE") {
      if (!validUuid(id))
        throw new AppError(400, "INVALID_SUPPLIER", "Fornecedor inválido.");
      const [row] =
        await sql`UPDATE nexo.finance_suppliers SET active=false,updated_date=now() WHERE id=${id} AND market_id=${user.market_id} RETURNING *`;
      if (!row)
        throw new AppError(
          404,
          "SUPPLIER_NOT_FOUND",
          "Fornecedor não encontrado.",
        );
      return send(res, 200, row);
    }
  }
  if (section === "accounts") {
    if (req.method === "GET")
      return send(
        res,
        200,
        await referenceList(sql, "finance_accounts", user.market_id),
      );
    requirePermission(permissions, "manage_accounts");
    if (!id && req.method === "POST")
      return send(res, 201, await saveAccount(sql, user, null, req.body || {}));
    if (id && req.method === "PATCH")
      return send(res, 200, await saveAccount(sql, user, id, req.body || {}));
  }
  if (section === "recurring") {
    if (!(user.enabled_features || []).includes("recurring_finance"))
      throw new AppError(
        403,
        "FEATURE_NOT_AVAILABLE",
        "Despesas recorrentes não estão incluídas neste plano.",
      );
    if (req.method === "GET") {
      const rows =
        await sql`SELECT * FROM nexo.finance_recurring_rules WHERE market_id=${user.market_id} ORDER BY active DESC,next_due_date`;
      return send(
        res,
        200,
        rows.map((row) => ({ ...row, amount: Number(row.amount) })),
      );
    }
    requirePermission(permissions, "create");
    if (!id && req.method === "POST") {
      const row = await saveRecurring(sql, user, null, req.body || {});
      invalidateFinanceMaintenance(user.market_id);
      return send(res, 201, row);
    }
    if (id && req.method === "PATCH") {
      const row = await saveRecurring(sql, user, id, req.body || {});
      invalidateFinanceMaintenance(user.market_id);
      return send(res, 200, row);
    }
  }
  if (section === "purchases") {
    if (!(user.enabled_features || []).includes("integrated_purchases"))
      throw new AppError(
        403,
        "FEATURE_NOT_AVAILABLE",
        "Compras integradas ao estoque não estão incluídas neste plano.",
      );
    requirePermission(permissions, "manage_purchases");
    if (!id && req.method === "GET")
      return send(res, 200, await listPurchases(sql, user.market_id));
    if (!id && req.method === "POST")
      return send(res, 201, await createPurchase(sql, user, req.body || {}));
    if (id && action === "confirm" && req.method === "POST")
      return send(res, 200, await confirmPurchase(sql, user, id));
    if (id && action === "cancel" && req.method === "POST")
      return send(
        res,
        200,
        await cancelPurchase(sql, user, id, req.body?.reason),
      );
  }
  if (section === "goals") {
    if (req.method === "GET") {
      const rows =
        await sql`SELECT goal.*,category.name AS category_name FROM nexo.finance_goals goal LEFT JOIN nexo.finance_categories category ON category.id=goal.category_id WHERE goal.market_id=${user.market_id} ORDER BY period DESC,type`;
      return send(
        res,
        200,
        rows.map((row) => ({ ...row, target_value: Number(row.target_value) })),
      );
    }
    requirePermission(permissions, "manage_settings");
    if (!id && req.method === "POST")
      return send(res, 201, await saveGoal(sql, user, null, req.body || {}));
    if (id && req.method === "PATCH")
      return send(res, 200, await saveGoal(sql, user, id, req.body || {}));
    if (id && req.method === "DELETE") {
      if (!validUuid(id))
        throw new AppError(400, "INVALID_GOAL", "Meta inválida.");
      const [row] =
        await sql`DELETE FROM nexo.finance_goals WHERE id=${id} AND market_id=${user.market_id} RETURNING id`;
      return send(
        res,
        row ? 200 : 404,
        row || { message: "Meta não encontrada." },
      );
    }
  }
  if (section === "settings") {
    if (req.method === "GET") {
      const rows =
        await sql`SELECT * FROM nexo.finance_settings WHERE market_id=${user.market_id}`;
      return send(res, 200, rows[0] || {});
    }
    requirePermission(permissions, "manage_settings");
    if (req.method === "PATCH")
      return send(res, 200, await saveSettings(sql, user, req.body || {}));
  }
  if (section === "permissions") {
    requirePermission(permissions, "manage_permissions");
    if (req.method === "PATCH" && id)
      return send(
        res,
        200,
        await saveUserPermissions(sql, user, id, req.body || {}),
      );
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
}
