/**
 * Manyame Rural District Council &mdash; Centralised Asset Register
 * Persists to localStorage; export CSV/JSON for audits and backups.
 */

(function () {
  "use strict";

  var STORAGE_KEY = "mrdc_asset_register_v1";
  var AUDIT_KEY = "mrdc_asset_audit_v1";

  var CONDITIONS = ["Excellent", "Good", "Fair", "Poor"];
  var CATEGORIES = [
    { value: "Vehicle", label: "Vehicle" },
    { value: "Furniture", label: "Furniture" },
    { value: "Equipment", label: "Equipment" },
  ];

  function nowIso() {
    return new Date().toISOString();
  }

  function loadAssets() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function saveAssets(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function loadAudit() {
    try {
      var raw = localStorage.getItem(AUDIT_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function appendAudit(entry) {
    var log = loadAudit();
    log.unshift({
      at: nowIso(),
      action: entry.action,
      detail: entry.detail,
      assetId: entry.assetId || null,
    });
    if (log.length > 500) log.length = 500;
    localStorage.setItem(AUDIT_KEY, JSON.stringify(log));
  }

  function generateId() {
    return "MRDC-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function escapeHtml(s) {
    if (s == null) return "";
    var div = document.createElement("div");
    div.textContent = String(s);
    return div.innerHTML;
  }

  function conditionClass(c) {
    var m = { Excellent: "excellent", Good: "good", Fair: "fair", Poor: "poor" };
    return m[c] || "fair";
  }

  function categoryClass(cat) {
    var m = { Vehicle: "vehicle", Furniture: "furniture", Equipment: "equipment" };
    return m[cat] || "equipment";
  }

  function formatDate(iso) {
    if (!iso) return "&mdash;";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return escapeHtml(String(iso));
      return escapeHtml(d.toLocaleDateString());
    } catch (e) {
      return escapeHtml(String(iso));
    }
  }

  function formatAuditTime(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleString();
    } catch (e) {
      return iso;
    }
  }

  var state = {
    assets: loadAssets(),
    editingId: null,
    filterText: "",
    filterCategory: "",
    filterCondition: "",
    filterLocation: "",
  };

  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function collectForm() {
    return {
      assetTag: ($("f_assetTag").value || "").trim(),
      name: ($("f_name").value || "").trim(),
      category: $("f_category").value,
      location: ($("f_location").value || "").trim(),
      department: ($("f_department").value || "").trim(),
      condition: $("f_condition").value,
      custodian: ($("f_custodian").value || "").trim(),
      acquisitionDate: $("f_acquisitionDate").value || "",
      purchaseValue: $("f_purchaseValue").value ? Number($("f_purchaseValue").value) : null,
      serialNumber: ($("f_serialNumber").value || "").trim(),
      notes: ($("f_notes").value || "").trim(),
    };
  }

  function fillForm(a) {
    $("f_assetTag").value = a.assetTag || "";
    $("f_name").value = a.name || "";
    $("f_category").value = a.category || "Equipment";
    $("f_location").value = a.location || "";
    $("f_department").value = a.department || "";
    $("f_condition").value = a.condition || "Good";
    $("f_custodian").value = a.custodian || "";
    $("f_acquisitionDate").value = a.acquisitionDate || "";
    $("f_purchaseValue").value = a.purchaseValue != null ? String(a.purchaseValue) : "";
    $("f_serialNumber").value = a.serialNumber || "";
    $("f_notes").value = a.notes || "";
  }

  function clearForm() {
    state.editingId = null;
    $("form-title").textContent = "Register new asset";
    $("btn-submit").textContent = "Save asset";
    $("btn-cancel-edit").hidden = true;
    fillForm({
      assetTag: "",
      name: "",
      category: "Equipment",
      location: "",
      department: "",
      condition: "Good",
      custodian: "",
      acquisitionDate: "",
      purchaseValue: null,
      serialNumber: "",
      notes: "",
    });
    $("f_name").focus();
  }

  function validate(row) {
    if (!row.name) return "Asset name is required.";
    if (!row.category) return "Category is required.";
    if (!row.location) return "Physical location is required.";
    if (!row.custodian) return "Custodian (responsible officer) is required.";
    return null;
  }

  function filteredAssets() {
    var t = state.filterText.toLowerCase();
    return state.assets.filter(function (a) {
      if (state.filterCategory && a.category !== state.filterCategory) return false;
      if (state.filterCondition && a.condition !== state.filterCondition) return false;
      if (state.filterLocation) {
        var loc = (a.location || "").toLowerCase();
        if (loc.indexOf(state.filterLocation.toLowerCase()) === -1) return false;
      }
      if (!t) return true;
      var hay = [
        a.assetTag,
        a.name,
        a.department,
        a.custodian,
        a.serialNumber,
        a.notes,
      ]
        .join(" ")
        .toLowerCase();
      return hay.indexOf(t) !== -1;
    });
  }

  function renderStats() {
    var list = state.assets;
    $("stat-total").textContent = String(list.length);
    var byCat = { Vehicle: 0, Furniture: 0, Equipment: 0 };
    var byCond = { Excellent: 0, Good: 0, Fair: 0, Poor: 0 };
    list.forEach(function (a) {
      if (byCat[a.category] != null) byCat[a.category]++;
      if (byCond[a.condition] != null) byCond[a.condition]++;
    });
    $("stat-vehicles").textContent = String(byCat.Vehicle);
    $("stat-furniture").textContent = String(byCat.Furniture);
    $("stat-equipment").textContent = String(byCat.Equipment);
    $("stat-needs-attention").textContent = String((byCond.Fair || 0) + (byCond.Poor || 0));
  }

  function renderTable() {
    var rows = filteredAssets();
    var tbody = $("asset-tbody");
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="message message--info">No assets match the current filters. Adjust filters or register a new asset above.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (a) {
        var cc = categoryClass(a.category);
        var cond = conditionClass(a.condition);
        return (
          "<tr data-id=\"" +
          escapeHtml(a.id) +
          "\">" +
          "<td><strong>" +
          escapeHtml(a.assetTag || "") +
          "</strong></td>" +
          "<td>" +
          escapeHtml(a.name || "") +
          "</td>" +
          "<td><span class=\"badge badge--" +
          cc +
          "\">" +
          escapeHtml(a.category || "") +
          "</span></td>" +
          "<td>" +
          escapeHtml(a.location || "") +
          "</td>" +
          "<td>" +
          escapeHtml(a.department || "") +
          "</td>" +
          "<td><span class=\"badge badge--" +
          cond +
          "\">" +
          escapeHtml(a.condition || "") +
          "</span></td>" +
          "<td>" +
          escapeHtml(a.custodian || "") +
          "</td>" +
          "<td>" +
          formatDate(a.updatedAt || a.createdAt) +
          "</td>" +
          "<td class=\"cell-actions\">" +
          "<button type=\"button\" class=\"btn btn--secondary btn-edit\" data-id=\"" +
          escapeHtml(a.id) +
          "\">Edit</button> " +
          "<button type=\"button\" class=\"btn btn--danger btn-delete\" data-id=\"" +
          escapeHtml(a.id) +
          "\">Remove</button>" +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderAudit() {
    var log = loadAudit();
    var ul = $("audit-list");
    if (!log.length) {
      ul.innerHTML = "<li>No audit events yet. Changes to the register are logged automatically.</li>";
      return;
    }
    ul.innerHTML = log
      .map(function (e) {
        return (
          "<li><time datetime=\"" +
          escapeHtml(e.at) +
          "\">" +
          escapeHtml(formatAuditTime(e.at)) +
          "</time> &mdash; <strong>" +
          escapeHtml(e.action) +
          "</strong>: " +
          escapeHtml(e.detail) +
          "</li>"
        );
      })
      .join("");
  }

  function refresh() {
    renderStats();
    renderTable();
    renderAudit();
  }

  function onSubmit(e) {
    e.preventDefault();
    var row = collectForm();
    var err = validate(row);
    if (err) {
      alert(err);
      return;
    }
    var ts = nowIso();
    if (state.editingId) {
      var idx = state.assets.findIndex(function (x) {
        return x.id === state.editingId;
      });
      if (idx === -1) return;
      var prev = state.assets[idx];
      if (!row.assetTag) row.assetTag = prev.assetTag;
      row.id = prev.id;
      row.createdAt = prev.createdAt;
      row.updatedAt = ts;
      state.assets[idx] = row;
      appendAudit({
        action: "Updated",
        detail: row.assetTag + " &mdash; " + row.name,
        assetId: row.id,
      });
    } else {
      row.id = generateId();
      row.assetTag = row.assetTag || row.id;
      row.createdAt = ts;
      row.updatedAt = ts;
      state.assets.push(row);
      appendAudit({
        action: "Created",
        detail: row.assetTag + " &mdash; " + row.name,
        assetId: row.id,
      });
    }
    saveAssets(state.assets);
    clearForm();
    refresh();
  }

  function onEdit(id) {
    var a = state.assets.find(function (x) {
      return x.id === id;
    });
    if (!a) return;
    state.editingId = id;
    $("form-title").textContent = "Edit asset";
    $("btn-submit").textContent = "Update asset";
    $("btn-cancel-edit").hidden = false;
    fillForm(a);
    $("asset-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onDelete(id) {
    var a = state.assets.find(function (x) {
      return x.id === id;
    });
    if (!a) return;
    if (!confirm("Remove this asset from the register? This cannot be undone from the browser.")) return;
    state.assets = state.assets.filter(function (x) {
      return x.id !== id;
    });
    saveAssets(state.assets);
    appendAudit({
      action: "Removed",
      detail: (a.assetTag || a.id) + " &mdash; " + (a.name || ""),
      assetId: id,
    });
    if (state.editingId === id) clearForm();
    refresh();
  }

  function exportCsv() {
    var headers = [
      "AssetTag",
      "Name",
      "Category",
      "Location",
      "Department",
      "Condition",
      "Custodian",
      "AcquisitionDate",
      "PurchaseValue",
      "SerialNumber",
      "Notes",
      "CreatedAt",
      "UpdatedAt",
      "InternalId",
    ];
    function csvCell(v) {
      var s = v == null ? "" : String(v);
      if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    var lines = [headers.join(",")];
    state.assets.forEach(function (a) {
      lines.push(
        [
          a.assetTag,
          a.name,
          a.category,
          a.location,
          a.department,
          a.condition,
          a.custodian,
          a.acquisitionDate,
          a.purchaseValue,
          a.serialNumber,
          a.notes,
          a.createdAt,
          a.updatedAt,
          a.id,
        ]
          .map(csvCell)
          .join(",")
      );
    });
    downloadBlob("mrdc-assets-" + todayStamp() + ".csv", lines.join("\r\n"), "text/csv;charset=utf-8");
    appendAudit({ action: "Export", detail: "CSV export (" + state.assets.length + " assets)" });
    renderAudit();
  }

  function exportJson() {
    var payload = {
      exportedAt: nowIso(),
      organisation: "Manyame Rural District Council",
      assets: state.assets,
      auditTrail: loadAudit(),
    };
    downloadBlob(
      "mrdc-assets-backup-" + todayStamp() + ".json",
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8"
    );
    appendAudit({ action: "Export", detail: "JSON backup (assets + audit trail)" });
    renderAudit();
  }

  function todayStamp() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function downloadBlob(filename, text, mime) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var list = data.assets;
        if (!Array.isArray(list)) throw new Error("Invalid file: missing assets array.");
        state.assets = list;
        saveAssets(state.assets);
        appendAudit({
          action: "Import",
          detail: "JSON import &mdash; " + list.length + " assets loaded",
        });
        clearForm();
        refresh();
        alert("Import completed. " + list.length + " assets are now in the register.");
      } catch (err) {
        alert("Import failed: " + (err && err.message ? err.message : String(err)));
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function bind() {
    $("asset-form").addEventListener("submit", onSubmit);
    $("btn-cancel-edit").addEventListener("click", function () {
      clearForm();
      refresh();
    });
    $("btn-export-csv").addEventListener("click", exportCsv);
    $("btn-export-json").addEventListener("click", exportJson);
    $("btn-print").addEventListener("click", function () {
      window.print();
    });
    $("import-file").addEventListener("change", function (ev) {
      var f = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      if (f) importJson(f);
    });
    $("search").addEventListener("input", function (ev) {
      state.filterText = ev.target.value;
      renderTable();
    });
    $("filter-category").addEventListener("change", function (ev) {
      state.filterCategory = ev.target.value;
      renderTable();
    });
    $("filter-condition").addEventListener("change", function (ev) {
      state.filterCondition = ev.target.value;
      renderTable();
    });
    $("filter-location").addEventListener("input", function (ev) {
      state.filterLocation = ev.target.value;
      renderTable();
    });
    $("btn-clear-filters").addEventListener("click", function () {
      state.filterText = "";
      state.filterCategory = "";
      state.filterCondition = "";
      state.filterLocation = "";
      $("search").value = "";
      $("filter-category").value = "";
      $("filter-condition").value = "";
      $("filter-location").value = "";
      renderTable();
    });
    $("asset-tbody").addEventListener("click", function (ev) {
      var t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.classList.contains("btn-edit")) {
        onEdit(t.getAttribute("data-id"));
      } else if (t.classList.contains("btn-delete")) {
        onDelete(t.getAttribute("data-id"));
      }
    });
  }

  function init() {
    bind();
    clearForm();
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
