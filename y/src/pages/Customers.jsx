import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "../App.css";

const API_URL = "http://localhost:3001";
const socket = io(API_URL);

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`الخادم لم يُرجع JSON صالحًا (${response.status})`);
  }
}

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    notes: "",
  });

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/api/customers`);

      if (!response.ok) {
        throw new Error("فشل تحميل العملاء");
      }

      const data = await readJsonResponse(response);
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError("مش قادر أوصل لقاعدة البيانات. تأكد إن السيرفر شغال.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();

    // الاستماع للتحديثات اللحظية عبر Socket.IO
    socket.on("data_updated", () => {
      loadCustomers();
    });

    return () => {
      socket.off("data_updated");
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((old) => ({
      ...old,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm({
      name: "",
      phone: "",
      notes: "",
    });

    setEditingId(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
    setError("");
  };

  const editCustomer = (customer) => {
    setEditingId(customer.id);

    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      notes: customer.notes || "",
    });

    setShowForm(true);
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const saveCustomer = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.phone.trim()) {
      alert("من فضلك اكتب اسم العميل ورقم الموبايل");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const url = editingId
        ? `${API_URL}/api/customers/${editingId}`
        : `${API_URL}/api/customers`;

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim(),
        }),
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "فشل حفظ بيانات العميل");
      }

      resetForm();
      setShowForm(false);
      loadCustomers();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomer = async (id) => {
    const confirmed = window.confirm(
      "هل أنت متأكد من حذف العميل؟\n\nلو العميل مرتبط بأجهزة أو دراعات، لن يسمح النظام بالحذف."
    );

    if (!confirmed) return;

    try {
      setError("");

      const response = await fetch(`${API_URL}/api/customers/${id}`, {
        method: "DELETE",
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "فشل حذف العميل");
      }

      loadCustomers();
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  return (
    <div className="customers-page">
      <div className="page-header">
        <div>
          <p className="small-title">CUSTOMERS</p>
          <h2>العملاء 👥</h2>
          <p>إدارة بيانات العملاء وسجل تعاملاتهم.</p>
        </div>

        <button
          className="main-button"
          onClick={() => {
            if (showForm) {
              resetForm();
              setShowForm(false);
            } else {
              openAddForm();
            }
          }}
        >
          {showForm ? "إلغاء" : "+ إضافة عميل"}
        </button>
      </div>

      {error && <div className="login-error">{error}</div>}

      {showForm && (
        <form className="customer-form" onSubmit={saveCustomer}>
          <div className="form-group">
            <label>اسم العميل</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="مثال: أحمد محمد"
            />
          </div>

          <div className="form-group">
            <label>رقم الموبايل</label>
            <input
              type="text"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="01xxxxxxxxx"
            />
          </div>

          <div className="form-group full">
            <label>ملاحظات</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="أي ملاحظات عن العميل..."
            />
          </div>

          <button type="submit" className="main-button" disabled={saving}>
            {saving
              ? "جاري الحفظ..."
              : editingId
              ? "حفظ التعديل"
              : "حفظ العميل"}
          </button>
        </form>
      )}

      <div className="content-card customers-list">
        <div className="card-title">
          <div>
            <h3>قائمة العملاء</h3>
            <p>عدد العملاء: {customers.length}</p>
          </div>

          <button className="secondary-button" onClick={loadCustomers}>
            تحديث
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <h3>جاري تحميل العملاء...</h3>
          </div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>لسه مفيش عملاء</h3>
            <p>اضغط على إضافة عميل لتسجيل أول عميل.</p>
          </div>
        ) : (
          <div className="customers-table" style={{ overflowX: "auto" }}>
            <div className="table-head" style={{ minWidth: "900px" }}>
              <span>الاسم</span>
              <span>رقم الموبايل</span>
              <span>تاريخ التسجيل</span>
              <span>ملاحظات</span>
              <span>الإجراءات</span>
            </div>

            {customers.map((customer) => (
              <div
                className="table-row"
                key={customer.id}
                style={{ minWidth: "900px" }}
              >
                <strong>{customer.name}</strong>
                <span>{customer.phone}</span>
                <span>
                  {customer.created_at
                    ? new Date(customer.created_at).toLocaleDateString("ar-EG")
                    : "-"}
                </span>
                <span>{customer.notes || "لا توجد ملاحظات"}</span>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => editCustomer(customer)}
                  >
                    ✏️ تعديل
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => deleteCustomer(customer.id)}
                    style={{ color: "#ff6b6b" }}
                  >
                    🗑️ حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Customers;