import { useEffect, useState } from "react";
import "../App.css";

const API_URL = "";

const DEVICE_MODELS = {
  PS5: [
    "PS5 Fat",
    "PS5 Slim",
    "PS5 Slim Digital",
    "PS5 Digital",
    "PS5 Pro",
  ],

  PS4: [
    "PS4 Fat",
    "PS4 Slim",
    "PS4 Pro",
  ],

  Xbox: [
    "Xbox One",
    "Xbox One S",
    "Xbox One X",
    "Xbox Series S",
    "Xbox Series X",
  ],

  "Nintendo Switch": [
    "Nintendo Switch",
    "Nintendo Switch Lite",
    "Nintendo Switch OLED",
    "Nintendo Switch 2",
  ],

  PC: [
    "Gaming PC",
    "Office PC",
    "Custom PC",
  ],

  Other: [],
};

const emptyForm = {
  device_type: "PS5",
  model: "",
  serial_number: "",
  status: "داخل المحل",
  notes: "",
};

function Devices() {
  const [devices, setDevices] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [customerSearch, setCustomerSearch] =
    useState("");

  const [selectedCustomer, setSelectedCustomer] =
    useState(null);

  const [modelSearch, setModelSearch] =
    useState("");

  const [showModelList, setShowModelList] =
    useState(false);

  const [editingId, setEditingId] =
    useState(null);

  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const devicesUrl = search.trim()
        ? `${API_URL}/api/devices?search=${encodeURIComponent(
            search.trim()
          )}`
        : `${API_URL}/api/devices`;

      const [
        devicesResponse,
        customersResponse,
      ] = await Promise.all([
        fetch(devicesUrl),
        fetch(`${API_URL}/api/customers`),
      ]);

      if (
        !devicesResponse.ok ||
        !customersResponse.ok
      ) {
        throw new Error(
          "فشل تحميل البيانات"
        );
      }

      setDevices(
        await devicesResponse.json()
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
  }, [search]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "device_type") {
      setForm({
        ...form,
        device_type: value,
        model: "",
      });

      setModelSearch("");
      setShowModelList(false);
      return;
    }

    setForm({
      ...form,
      [name]: value,
    });
  };

  /* =========================
     CUSTOMER SEARCH
  ========================= */

  const filteredCustomers =
    customers.filter((customer) => {
      const value =
        customerSearch
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
     MODEL SEARCH
  ========================= */

  const availableModels =
    DEVICE_MODELS[form.device_type] ||
    [];

  const filteredModels =
    availableModels.filter((model) =>
      model
        .toLowerCase()
        .includes(
          modelSearch
            .trim()
            .toLowerCase()
        )
    );

  const selectModel = (model) => {
    setForm({
      ...form,
      model,
    });

    setModelSearch(model);
    setShowModelList(false);
  };

  /* =========================
     OPEN ADD FORM
  ========================= */

  const openAddForm = () => {
    setEditingId(null);

    setForm({
      ...emptyForm,
    });

    clearCustomer();

    setModelSearch("");
    setShowModelList(false);

    setError("");
    setShowForm(true);
  };

  /* =========================
     OPEN EDIT FORM
  ========================= */

  const editDevice = (device) => {
    const customer = customers.find(
      (item) =>
        Number(item.id) ===
        Number(device.customer_id)
    );

    setEditingId(device.id);

    setForm({
      device_type:
        device.device_type || "PS5",
      model: device.model || "",
      serial_number:
        device.serial_number || "",
      status:
        device.status || "داخل المحل",
      notes: device.notes || "",
    });

    if (customer) {
      setSelectedCustomer(customer);

      setCustomerSearch(
        `${customer.name} - ${customer.phone}`
      );
    } else {
      setSelectedCustomer(null);
      setCustomerSearch("");
    }

    setModelSearch(
      device.model || ""
    );

    setShowModelList(false);
    setError("");
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =========================
     CANCEL FORM
  ========================= */

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);

    setForm({
      ...emptyForm,
    });

    clearCustomer();

    setModelSearch("");
    setShowModelList(false);
    setError("");
  };

  /* =========================
     SAVE DEVICE
  ========================= */

  const saveDevice = async (e) => {
    e.preventDefault();

    if (!selectedCustomer) {
      alert(
        "اكتب اسم العميل أو رقم الموبايل واختار العميل"
      );
      return;
    }

    if (!form.model) {
      alert(
        "اختار موديل الجهاز"
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const isEditing =
        editingId !== null;

      const url = isEditing
        ? `${API_URL}/api/devices/${editingId}`
        : `${API_URL}/api/devices`;

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

            device_type:
              form.device_type,

            model:
              form.model,

            serial_number:
              form.serial_number,

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
            "فشل حفظ الجهاز"
        );
      }

      if (isEditing) {
        setDevices((old) =>
          old.map((item) =>
            item.id === data.id
              ? data
              : item
          )
        );
      } else {
        setDevices((old) => [
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
     DELETE DEVICE
  ========================= */

  const deleteDevice = async (
    device
  ) => {
    const confirmed =
      window.confirm(
        `هل أنت متأكد من حذف الجهاز رقم ${device.label_number || device.id}؟`
      );

    if (!confirmed) return;

    try {
      setError("");

      const response =
        await fetch(
          `${API_URL}/api/devices/${device.id}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "فشل حذف الجهاز"
        );
      }

      setDevices((old) =>
        old.filter(
          (item) =>
            item.id !== device.id
        )
      );
    } catch (err) {
      setError(err.message);
    }
  };

  /* =========================
     PRINT LABEL
  ========================= */

  const printLabel = (device) => {
    const labelNumber =
      device.label_number ||
      `L-${String(device.id).padStart(
        5,
        "0"
      )}`;

    const customerName =
      device.customer_name || "-";

    const customerPhone =
      device.customer_phone || "-";

    const deviceName =
      `${device.device_type || ""}${
        device.model
          ? ` - ${device.model}`
          : ""
      }`;

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
      <html lang="en">
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
            padding: 5mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: center;
          }

          .shop {
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 3mm;
          }

          .label-number {
            font-size: 22px;
            font-weight: bold;
            margin-bottom: 3mm;
          }

          .customer {
            font-size: 15px;
            font-weight: bold;
          }

          .phone {
            font-size: 13px;
            margin-top: 1mm;
          }

          .device {
            font-size: 15px;
            font-weight: bold;
            margin-top: 3mm;
          }

          .serial {
            font-size: 11px;
            margin-top: 2mm;
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

          <div class="device">
            ${deviceName}
          </div>

          ${
            device.serial_number
              ? `
                <div class="serial">
                  SN: ${device.serial_number}
                </div>
              `
              : ""
          }

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
            DEVICES
          </p>

          <h2>
            الأجهزة 🎮
          </h2>

          <p>
            تسجيل ومتابعة أجهزة العملاء.
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
            : "+ تسجيل جهاز"}
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
          onSubmit={saveDevice}
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

          {/* DEVICE TYPE */}

          <div className="form-group">
            <label>
              Device Type
            </label>

            <select
              name="device_type"
              value={
                form.device_type
              }
              onChange={
                handleChange
              }
            >
              <option value="PS5">
                PlayStation 5
              </option>

              <option value="PS4">
                PlayStation 4
              </option>

              <option value="Xbox">
                Xbox
              </option>

              <option value="Nintendo Switch">
                Nintendo Switch
              </option>

              <option value="PC">
                PC
              </option>

              <option value="Other">
                Other
              </option>
            </select>
          </div>

          {/* MODEL */}

          <div
            className="form-group"
            style={{
              position:
                "relative",
            }}
          >
            <label>
              Model
            </label>

            <input
              type="text"
              value={modelSearch}
              onFocus={() =>
                setShowModelList(
                  true
                )
              }
              onChange={(e) => {
                setModelSearch(
                  e.target.value
                );

                setForm({
                  ...form,
                  model:
                    e.target.value,
                });

                setShowModelList(
                  true
                );
              }}
              placeholder="Search model... e.g. sl, pro, fat"
              autoComplete="off"
            />

            {showModelList &&
              filteredModels.length >
                0 && (
                <div
                  style={{
                    position:
                      "absolute",
                    top: "100%",
                    right: 0,
                    left: 0,
                    zIndex: 30,
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
                  {filteredModels.map(
                    (model) => (
                      <button
                        key={model}
                        type="button"
                        onClick={() =>
                          selectModel(
                            model
                          )
                        }
                        style={{
                          width:
                            "100%",
                          padding:
                            "13px",
                          border:
                            "none",
                          borderBottom:
                            "1px solid #292932",
                          background:
                            "transparent",
                          color:
                            "white",
                          textAlign:
                            "left",
                          cursor:
                            "pointer",
                        }}
                      >
                        {model}
                      </button>
                    )
                  )}
                </div>
              )}
          </div>

          {/* SERIAL */}

          <div className="form-group">
            <label>
              Serial Number
            </label>

            <input
              type="text"
              name="serial_number"
              value={
                form.serial_number
              }
              onChange={
                handleChange
              }
              placeholder="Enter serial number"
            />
          </div>

          {/* STATUS */}

          <div className="form-group">
            <label>
              Status
            </label>

            <select
              name="status"
              value={form.status}
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

          <div className="form-group">
            <label>
              Notes
            </label>

            <input
              type="text"
              name="notes"
              value={form.notes}
              onChange={
                handleChange
              }
              placeholder="Notes..."
            />
          </div>

          {/* SAVE */}

          <button
            type="submit"
            className="main-button"
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : editingId !== null
              ? "Update Device"
              : "Save Device"}
          </button>

        </form>
      )}

      {/* DEVICES LIST */}

      <div className="content-card customers-list">

        <div className="card-title">

          <div>
            <h3>
              قائمة الأجهزة
            </h3>

            <p>
              عدد الأجهزة:{" "}
              {devices.length}
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
            placeholder="Search by customer name, phone or Label Number..."
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
              جاري تحميل الأجهزة...
            </h3>
          </div>
        ) : devices.length ===
          0 ? (
          <div className="empty-state">

            <div className="empty-icon">
              🎮
            </div>

            <h3>
              مفيش نتائج
            </h3>

            <p>
              جرّب اسم العميل أو رقم الموبايل أو رقم الـLabel.
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
                الجهاز
              </span>

              <span>
                Serial
              </span>

              <span>
                الحالة
              </span>

              <span>
                التاريخ
              </span>

              <span>
                الإجراءات
              </span>
            </div>

            {devices.map(
              (device) => (
                <div
                  className="table-row"
                  key={
                    device.id
                  }
                >

                  <strong
                    style={{
                      color:
                        "#d4af37",
                      fontWeight:
                        "bold",
                    }}
                  >
                    {
                      device.label_number ||
                      `L-${String(
                        device.id
                      ).padStart(
                        5,
                        "0"
                      )}`
                    }
                  </strong>

                  <div>
                    <strong>
                      {
                        device.customer_name
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
                        device.customer_phone
                      }
                    </small>
                  </div>

                  <span>
                    {
                      device.device_type
                    }

                    {device.model
                      ? ` - ${device.model}`
                      : ""}
                  </span>

                  <span>
                    {
                      device.serial_number ||
                      "-"
                    }
                  </span>

                  <span>
                    {
                      device.status
                    }
                  </span>

                  <span>
                    {new Date(
                      device.received_at
                    ).toLocaleDateString(
                      "en-GB"
                    )}
                  </span>

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
                          device
                        )
                      }
                    >
                      🏷️ Print
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        editDevice(
                          device
                        )
                      }
                    >
                      ✏️ تعديل
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        deleteDevice(
                          device
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

export default Devices;