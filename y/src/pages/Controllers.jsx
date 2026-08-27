import { useEffect, useState } from "react";
import "../App.css";

const API_URL = "";

const CONTROLLER_TYPES = [
  "دراع PS4",
  "دراع PS5",
  "دراع Xbox One",
  "دراع Xbox Series",
  "دراع Nintendo Switch",
  "دراع آخر",
];

const emptyForm = {
  controller_type: "دراع PS4",
  quantity: 1,
  condition: "Original",
  repair_cost: 0,
  status: "داخل المحل",
  notes: "",
};

function Controllers() {
  const [controllers, setControllers] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [controllersResponse, customersResponse] =
        await Promise.all([
          fetch(`${API_URL}/api/controllers`),
          fetch(`${API_URL}/api/customers`),
        ]);

      if (
        !controllersResponse.ok ||
        !customersResponse.ok
      ) {
        throw new Error("فشل تحميل البيانات");
      }

      setControllers(
        await controllersResponse.json()
      );

      setCustomers(
        await customersResponse.json()
      );
    } catch (err) {
      setError(
        "مش قادر أوصل للسيرفر. تأكد إن السيرفر شغال."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]: value,
    });
  };

  /* =========================
     SEARCH
  ========================= */

  const filteredControllers =
    controllers.filter((controller) => {
      const value = search
        .trim()
        .toLowerCase();

      if (!value) return true;

      return (
        String(
          controller.label_number || ""
        )
          .toLowerCase()
          .includes(value) ||
        String(
          controller.customer_name || ""
        )
          .toLowerCase()
          .includes(value) ||
        String(
          controller.customer_phone || ""
        )
          .toLowerCase()
          .includes(value) ||
        String(
          controller.controller_type || ""
        )
          .toLowerCase()
          .includes(value)
      );
    });

  /* =========================
     CUSTOMER SEARCH
  ========================= */

  const filteredCustomers =
    customers.filter((customer) => {
      const value = customerSearch
        .trim()
        .toLowerCase();

      if (!value) return false;

      return (
        customer.name
          .toLowerCase()
          .includes(value) ||
        customer.phone
          .toLowerCase()
          .includes(value)
      );
    });

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);

    setCustomerSearch(
      `${customer.name} - ${customer.phone}`
    );
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearch("");
  };

  /* =========================
     ADD
  ========================= */

  const openAddForm = () => {
    setEditingId(null);

    setForm({
      ...emptyForm,
    });

    clearCustomer();

    setError("");
    setShowForm(true);
  };

  /* =========================
     EDIT
  ========================= */

  const editController = (controller) => {
    const customer = customers.find(
      (item) =>
        Number(item.id) ===
        Number(controller.customer_id)
    );

    setEditingId(controller.id);

    setForm({
      controller_type:
        controller.controller_type ||
        "دراع PS4",

      quantity:
        controller.quantity || 1,

      condition:
        controller.condition ||
        "Original",

      repair_cost:
        controller.repair_cost || 0,

      status:
        controller.status ||
        "داخل المحل",

      notes:
        controller.notes || "",
    });

    if (customer) {
      setSelectedCustomer(customer);

      setCustomerSearch(
        `${customer.name} - ${customer.phone}`
      );
    } else {
      clearCustomer();
    }

    setError("");
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =========================
     CANCEL
  ========================= */

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);

    setForm({
      ...emptyForm,
    });

    clearCustomer();
    setError("");
  };

  /* =========================
     SAVE
  ========================= */

  const saveController = async (e) => {
    e.preventDefault();

    if (!selectedCustomer) {
      alert(
        "اكتب اسم العميل أو رقم الموبايل واختار العميل"
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const isEditing =
        editingId !== null;

      const url = isEditing
        ? `${API_URL}/api/controllers/${editingId}`
        : `${API_URL}/api/controllers`;

      const response = await fetch(
        url,
        {
          method: isEditing
            ? "PUT"
            : "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            customer_id:
              selectedCustomer.id,

            controller_type:
              form.controller_type,

            quantity:
              Number(form.quantity) || 1,

            condition:
              form.condition,

            repair_cost:
              Number(form.repair_cost) || 0,

            status:
              form.status,

            notes:
              form.notes,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "فشل حفظ الدراع"
        );
      }

      if (isEditing) {
        setControllers((old) =>
          old.map((item) =>
            item.id === data.id
              ? data
              : item
          )
        );
      } else {
        setControllers((old) => [
          data,
          ...old,
        ]);
      }

      cancelForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     DELETE
  ========================= */

  const deleteController = async (
    controller
  ) => {
    const confirmed =
      window.confirm(
        `هل أنت متأكد من حذف الدراع ${controller.label_number || controller.id}؟`
      );

    if (!confirmed) return;

    try {
      setError("");

      const response =
        await fetch(
          `${API_URL}/api/controllers/${controller.id}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "فشل حذف الدراع"
        );
      }

      setControllers((old) =>
        old.filter(
          (item) =>
            item.id !== controller.id
        )
      );
    } catch (err) {
      setError(err.message);
    }
  };

  /* =========================
     PRINT LABEL
  ========================= */

  const printLabel = (controller) => {
    const labelNumber =
      controller.label_number ||
      `C-${String(
        controller.id
      ).padStart(5, "0")}`;

    const customerName =
      controller.customer_name || "-";

    const customerPhone =
      controller.customer_phone || "-";

    const controllerType =
      controller.controller_type ||
      "دراع";

    const condition =
      controller.condition ||
      "Original";

    const quantity =
      controller.quantity || 1;

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=500,height=500"
      );

    if (!printWindow) {
      alert(
        "المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة."
      );
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>

      <html lang="ar" dir="rtl">

      <head>
        <meta charset="UTF-8" />

        <title>${labelNumber}</title>

        <style>

          @page {
            size: 80mm 50mm;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background: white;
            color: black;
          }

          .label {
            width: 80mm;
            min-height: 50mm;
            padding: 4mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: center;
          }

          .shop {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 2mm;
          }

          .label-number {
            font-size: 22px;
            font-weight: bold;
            margin-bottom: 2mm;
          }

          .customer {
            font-size: 15px;
            font-weight: bold;
          }

          .phone {
            font-size: 12px;
            margin-top: 1mm;
          }

          .controller {
            font-size: 17px;
            font-weight: bold;
            margin-top: 3mm;
          }

          .condition {
            font-size: 13px;
            font-weight: bold;
            margin-top: 1mm;
          }

          .quantity {
            font-size: 12px;
            margin-top: 1mm;
          }

        </style>
      </head>

      <body>

        <div class="label">

          <div class="shop">
            ABU AL-KHAIR GAMING SHOP
          </div>

          <div class="label-number">
            ${labelNumber}
          </div>

          <div class="customer">
            ${customerName}
          </div>

          <div class="phone">
            ${customerPhone}
          </div>

          <div class="controller">
            ${controllerType}
          </div>

          <div class="condition">
            ${condition}
          </div>

          <div class="quantity">
            الكمية: ${quantity}
          </div>

        </div>

        <script>

          window.onload = function () {

            window.print();

            setTimeout(function () {
              window.close();
            }, 500);

          };

        </script>

      </body>

      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="customers-page">

      {/* HEADER */}

      <div className="page-header">

        <div>

          <p className="small-title">
            CONTROLLERS
          </p>

          <h2>
            الدراعات 🕹️
          </h2>

          <p>
            تسجيل ومتابعة دراعات العملاء.
          </p>

        </div>

        <button
          className="main-button"
          onClick={() => {
            if (showForm) {
              cancelForm();
            } else {
              openAddForm();
            }
          }}
        >
          {showForm
            ? "إلغاء"
            : "+ تسجيل دراع"}
        </button>

      </div>

      {/* ERROR */}

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

      {/* FORM */}

      {showForm && (
        <form
          className="customer-form"
          onSubmit={saveController}
        >

          {/* CUSTOMER */}

          <div
            className="form-group full"
            style={{
              position: "relative",
            }}
          >

            <label>
              العميل
            </label>

            <input
              type="text"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(
                  e.target.value
                );

                setSelectedCustomer(
                  null
                );
              }}
              placeholder="اكتب اسم العميل أو رقم الموبايل..."
              autoComplete="off"
            />

            {!selectedCustomer &&
              customerSearch.trim() &&
              filteredCustomers.length >
                0 && (

                <div
                  style={{
                    position:
                      "absolute",
                    top: "100%",
                    right: 0,
                    left: 0,
                    zIndex: 20,
                    background:
                      "#15151b",
                    border:
                      "1px solid #33333d",
                    borderRadius:
                      "0 0 12px 12px",
                    overflow:
                      "hidden",
                  }}
                >

                  {filteredCustomers
                    .slice(0, 8)
                    .map(
                      (customer) => (

                        <button
                          key={
                            customer.id
                          }
                          type="button"
                          onClick={() =>
                            selectCustomer(
                              customer
                            )
                          }
                          style={{
                            width:
                              "100%",
                            padding:
                              "14px",
                            border:
                              "none",
                            borderBottom:
                              "1px solid #292932",
                            background:
                              "transparent",
                            color:
                              "white",
                            textAlign:
                              "right",
                            cursor:
                              "pointer",
                          }}
                        >

                          <strong>
                            {
                              customer.name
                            }
                          </strong>

                          <br />

                          <small
                            style={{
                              color:
                                "#aaa",
                            }}
                          >
                            {
                              customer.phone
                            }
                          </small>

                        </button>

                      )
                    )}

                </div>
              )}

            {selectedCustomer && (

              <div
                style={{
                  marginTop:
                    "10px",
                  padding:
                    "12px 15px",
                  borderRadius:
                    "10px",
                  background:
                    "rgba(212,175,55,0.08)",
                  border:
                    "1px solid rgba(212,175,55,0.3)",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                }}
              >

                <div>

                  <strong>
                    العميل:{" "}
                    {
                      selectedCustomer.name
                    }
                  </strong>

                  <div
                    style={{
                      color:
                        "#aaa",
                    }}
                  >
                    {
                      selectedCustomer.phone
                    }
                  </div>

                </div>

                <button
                  type="button"
                  onClick={
                    clearCustomer
                  }
                  className="secondary-button"
                >
                  تغيير
                </button>

              </div>

            )}

          </div>

          {/* CONTROLLER TYPE */}

          <div className="form-group">

            <label>
              نوع الدراع
            </label>

            <select
              name="controller_type"
              value={
                form.controller_type
              }
              onChange={
                handleChange
              }
            >

              {CONTROLLER_TYPES.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type}
                  </option>
                )
              )}

            </select>

          </div>

          {/* CONDITION */}

          <div className="form-group">

            <label>
              حالة الدراع
            </label>

            <select
              name="condition"
              value={
                form.condition
              }
              onChange={
                handleChange
              }
            >

              <option value="Original">
                Original
              </option>

              <option value="Copy">
                Copy
              </option>

            </select>

          </div>

          {/* QUANTITY */}

          <div className="form-group">

            <label>
              الكمية
            </label>

            <input
              type="number"
              name="quantity"
              min="1"
              value={
                form.quantity
              }
              onChange={
                handleChange
              }
            />

          </div>

          {/* REPAIR COST */}

          <div className="form-group">

            <label>
              تكلفة الصيانة
            </label>

            <input
              type="number"
              name="repair_cost"
              min="0"
              value={
                form.repair_cost
              }
              onChange={
                handleChange
              }
              placeholder="0"
            />

          </div>

          {/* STATUS */}

          <div className="form-group">

            <label>
              الحالة
            </label>

            <select
              name="status"
              value={
                form.status
              }
              onChange={
                handleChange
              }
            >

              <option value="داخل المحل">
                داخل المحل
              </option>

              <option value="قيد الصيانة">
                قيد الصيانة
              </option>

              <option value="جاهز للتسليم">
                جاهز للتسليم
              </option>

              <option value="تم التسليم">
                تم التسليم
              </option>

            </select>

          </div>

          {/* NOTES */}

          <div className="form-group full">

            <label>
              ملاحظات
            </label>

            <input
              type="text"
              name="notes"
              value={
                form.notes
              }
              onChange={
                handleChange
              }
              placeholder="أي ملاحظات عن الدراع..."
            />

          </div>

          {/* SAVE */}

          <button
            type="submit"
            className="main-button"
            disabled={saving}
          >

            {saving
              ? "جاري الحفظ..."
              : editingId !== null
              ? "تعديل الدراع"
              : "حفظ الدراع"}

          </button>

        </form>
      )}

      {/* LIST */}

      <div className="content-card customers-list">

        <div className="card-title">

          <div>

            <h3>
              قائمة الدراعات
            </h3>

            <p>
              عدد الدراعات:{" "}
              {controllers.length}
            </p>

          </div>

          <button
            className="secondary-button"
            onClick={
              loadData
            }
          >
            تحديث
          </button>

        </div>

        {/* SEARCH */}

        <div
          style={{
            marginBottom:
              "20px",
          }}
        >

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="ابحث باسم العميل أو رقم الموبايل أو رقم الليبل أو نوع الدراع..."
            style={{
              width:
                "100%",
              padding:
                "14px 16px",
              borderRadius:
                "12px",
              border:
                "1px solid #33333d",
              background:
                "#15151b",
              color:
                "white",
              outline:
                "none",
            }}
          />

        </div>

        {loading ? (

          <div className="empty-state">

            <div className="empty-icon">
              ⏳
            </div>

            <h3>
              جاري تحميل الدراعات...
            </h3>

          </div>

        ) : filteredControllers.length ===
          0 ? (

          <div className="empty-state">

            <div className="empty-icon">
              🕹️
            </div>

            <h3>
              مفيش نتائج
            </h3>

            <p>
              سجّل أول دراع أو جرّب البحث بطريقة مختلفة.
            </p>

          </div>

        ) : (

          <div className="customers-table">

            <div className="table-head">

              <span>
                Label
              </span>

              <span>
                العميل
              </span>

              <span>
                الدراع
              </span>

              <span>
                النوع
              </span>

              <span>
                الكمية
              </span>

              <span>
                الحالة
              </span>

              <span>
                التكلفة
              </span>

              <span>
                التاريخ
              </span>

              <span>
                الإجراءات
              </span>

            </div>

            {filteredControllers.map(
              (controller) => (

                <div
                  className="table-row"
                  key={
                    controller.id
                  }
                >

                  {/* LABEL */}

                  <strong
                    style={{
                      color:
                        "#d4af37",
                      fontWeight:
                        "bold",
                    }}
                  >
                    {
                      controller.label_number ||
                      `C-${String(
                        controller.id
                      ).padStart(
                        5,
                        "0"
                      )}`
                    }
                  </strong>

                  {/* CUSTOMER */}

                  <div>

                    <strong>
                      {
                        controller.customer_name
                      }
                    </strong>

                    <small
                      style={{
                        display:
                          "block",
                        color:
                          "#999",
                        marginTop:
                          "4px",
                      }}
                    >
                      {
                        controller.customer_phone
                      }
                    </small>

                  </div>

                  {/* CONTROLLER */}

                  <strong>
                    {
                      controller.controller_type
                    }
                  </strong>

                  {/* CONDITION */}

                  <span>
                    {
                      controller.condition ||
                      "Original"
                    }
                  </span>

                  {/* QUANTITY */}

                  <span>
                    {
                      controller.quantity ||
                      1
                    }
                  </span>

                  {/* STATUS */}

                  <span>
                    {
                      controller.status
                    }
                  </span>

                  {/* REPAIR COST */}

                  <span>
                    {Number(
                      controller.repair_cost ||
                        0
                    ).toLocaleString(
                      "ar-EG"
                    )}{" "}
                    ج.م
                  </span>

                  {/* DATE */}

                  <span>
                    {new Date(
                      controller.received_at
                    ).toLocaleDateString(
                      "ar-EG"
                    )}
                  </span>

                  {/* ACTIONS */}

                  <div
                    style={{
                      display:
                        "flex",
                      gap:
                        "6px",
                      flexWrap:
                        "wrap",
                    }}
                  >

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        printLabel(
                          controller
                        )
                      }
                    >
                      🏷️ طباعة
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        editController(
                          controller
                        )
                      }
                    >
                      ✏️ تعديل
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        deleteController(
                          controller
                        )
                      }
                    >
                      🗑️ حذف
                    </button>

                  </div>

                </div>

              )
            )}

          </div>

        )}

      </div>

    </div>
  );
}

export default Controllers;