import { useEffect, useState } from "react";

const API_URL = "";

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`الخادم لم يُرجع JSON صالحًا (${response.status})`);
  }
}

function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    deviceName: "",
    serialNumber: "",
    price: "",
    purchaseDate: new Date()
      .toISOString()
      .split("T")[0],
    warrantyMonths: "12",
  });

  const [search, setSearch] = useState("");

  const loadData = async () => {
    try {
      const invoicesResponse =
        await fetch(`${API_URL}/api/invoices`);

      if (invoicesResponse.ok) {
        const data = await invoicesResponse.json();
        setInvoices(data);
      }
    } catch (error) {
      console.error("Invoices error:", error);
    }

    try {
      const customersResponse =
        await fetch(`${API_URL}/api/customers`);

      if (customersResponse.ok) {
        const data = await readJsonResponse(customersResponse);
        setCustomers(data);
      }
    } catch (error) {
      console.error("Customers error:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const calculateWarrantyEnd = () => {
    if (!form.purchaseDate) return "";

    const date = new Date(form.purchaseDate);

    date.setMonth(
      date.getMonth() +
        Number(form.warrantyMonths || 0)
    );

    return date.toISOString().split("T")[0];
  };

  const getWarrantyStatus = (warrantyEnd) => {
    if (!warrantyEnd) {
      return {
        text: "غير محدد",
        className: "warranty-unknown",
      };
    }

    const today = new Date();
    const end = new Date(warrantyEnd);

    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end < today) {
      return {
        text: "الضمان منتهي",
        className: "warranty-expired",
      };
    }

    const difference =
      end.getTime() - today.getTime();

    const daysLeft = Math.ceil(
      difference / (1000 * 60 * 60 * 24)
    );

    if (daysLeft <= 30) {
      return {
        text: `ينتهي خلال ${daysLeft} يوم`,
        className: "warranty-warning",
      };
    }

    return {
      text: "الضمان ساري",
      className: "warranty-active",
    };
  };

  const handleCustomerChange = (value) => {
    const customer = customers.find(
      (item) =>
        String(item.phone) === String(value) ||
        String(item.id) === String(value)
    );

    if (customer) {
      setForm((prev) => ({
        ...prev,
        customerPhone: customer.phone || "",
        customerName: customer.name || "",
      }));
    } else {
      updateForm("customerPhone", value);
    }
  };

  const saveInvoice = async (e) => {
    e.preventDefault();

    if (
      !form.customerName.trim() ||
      !form.customerPhone.trim() ||
      !form.deviceName.trim() ||
      !form.serialNumber.trim() ||
      !form.price
    ) {
      alert("من فضلك أكمل بيانات الفاتورة");
      return;
    }

    const warrantyEnd = calculateWarrantyEnd();

    const invoice = {
      ...form,
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      deviceName: form.deviceName.trim(),
      serialNumber: form.serialNumber.trim(),
      price: Number(form.price),
      warrantyMonths: Number(form.warrantyMonths),
      warrantyEnd,
      invoiceDate: new Date().toISOString(),
    };

    try {
      const response = await fetch(
        `${API_URL}/api/invoices`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invoice),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save invoice");
      }

      alert("تم حفظ الفاتورة بنجاح ✅");

      setForm({
        customerName: "",
        customerPhone: "",
        deviceName: "",
        serialNumber: "",
        price: "",
        purchaseDate: new Date()
          .toISOString()
          .split("T")[0],
        warrantyMonths: "12",
      });

      loadData();
    } catch (error) {
      console.error("Save invoice error:", error);

      alert("حصل خطأ أثناء حفظ الفاتورة");
    }
  };

  /* =========================
     PRINT INVOICE
  ========================= */

  const printInvoice = (invoice) => {
    const warranty = getWarrantyStatus(
      invoice.warrantyEnd
    );

    const price = Number(
      invoice.price || 0
    ).toLocaleString("ar-EG");

    const warrantyMonths =
      Number(invoice.warrantyMonths || 0);

    const warrantyText =
      warrantyMonths === 0
        ? "بدون ضمان"
        : `${warrantyMonths} شهر`;

    const printWindow = window.open(
      "",
      "_blank",
      "width=900,height=900"
    );

    if (!printWindow) {
      alert(
        "المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة للموقع."
      );
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />

        <title>
          فاتورة ${invoice.invoiceNumber || ""}
        </title>

        <style>

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 30px;
            background: #f2f2f2;
            font-family:
              Arial,
              Tahoma,
              sans-serif;
            color: #111;
          }

          .invoice {
            width: 210mm;
            min-height: 297mm;
            margin: auto;
            padding: 18mm;
            background: white;
            box-shadow:
              0 5px 30px rgba(0,0,0,0.15);
          }

          .top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #111;
            padding-bottom: 20px;
          }

          .shop {
            text-align: right;
          }

          .shop-name {
            font-size: 30px;
            font-weight: 900;
            letter-spacing: 1px;
          }

          .shop-subtitle {
            margin-top: 6px;
            font-size: 14px;
            color: #555;
          }

          .invoice-title {
            text-align: left;
          }

          .invoice-title h1 {
            margin: 0;
            font-size: 28px;
          }

          .invoice-number {
            margin-top: 8px;
            font-size: 15px;
            font-weight: bold;
          }

          .date {
            margin-top: 5px;
            color: #555;
            font-size: 13px;
          }

          .customer-box {
            margin-top: 25px;
            padding: 18px;
            border: 1px solid #ddd;
            border-radius: 10px;
            background: #fafafa;
          }

          .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 12px;
          }

          .customer-grid {
            display: grid;
            grid-template-columns:
              1fr 1fr;
            gap: 10px;
          }

          .info {
            font-size: 15px;
          }

          .info span {
            color: #666;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 25px;
          }

          th {
            background: #111;
            color: white;
            padding: 13px 10px;
            font-size: 14px;
          }

          td {
            padding: 15px 10px;
            border-bottom: 1px solid #ddd;
            font-size: 14px;
          }

          .total-box {
            margin-top: 20px;
            display: flex;
            justify-content: flex-start;
          }

          .total {
            width: 300px;
            border: 2px solid #111;
            border-radius: 8px;
            padding: 15px;
          }

          .total-label {
            font-size: 14px;
            color: #555;
          }

          .total-price {
            margin-top: 5px;
            font-size: 25px;
            font-weight: 900;
          }

          .warranty-box {
            margin-top: 25px;
            padding: 18px;
            border: 1px solid #ccc;
            border-radius: 10px;
          }

          .warranty-status {
            margin-top: 10px;
            font-weight: bold;
          }

          .footer {
            margin-top: 80px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            color: #555;
          }

          .signature {
            margin-top: 55px;
            display: flex;
            justify-content: space-between;
            text-align: center;
          }

          .signature-box {
            width: 200px;
            padding-top: 45px;
            border-top: 1px solid #111;
          }

          .print-button {
            position: fixed;
            top: 20px;
            left: 20px;
            padding: 12px 20px;
            border: 0;
            border-radius: 8px;
            background: #111;
            color: white;
            font-size: 16px;
            cursor: pointer;
          }

          @media print {

            body {
              padding: 0;
              background: white;
            }

            .invoice {
              width: 100%;
              min-height: auto;
              padding: 10mm;
              box-shadow: none;
            }

            .print-button {
              display: none;
            }

            @page {
              size: A4;
              margin: 0;
            }
          }

        </style>
      </head>

      <body>

        <button
          class="print-button"
          onclick="window.print()"
        >
          🖨️ طباعة الفاتورة
        </button>

        <div class="invoice">

          <div class="top">

            <div class="shop">

              <div class="shop-name">
                ABU AL-KHAIR
              </div>

              <div class="shop-subtitle">
                GAMING SHOP
              </div>

              <div class="shop-subtitle">
                نظام إدارة الأجهزة والعملاء
              </div>

            </div>

            <div class="invoice-title">

              <h1>
                فاتورة بيع
              </h1>

              <div class="invoice-number">
                رقم الفاتورة:
                ${invoice.invoiceNumber || `#${invoice.id}`}
              </div>

              <div class="date">
                تاريخ الشراء:
                ${invoice.purchaseDate || "-"}
              </div>

            </div>

          </div>

          <div class="customer-box">

            <div class="section-title">
              بيانات العميل
            </div>

            <div class="customer-grid">

              <div class="info">
                <span>الاسم:</span>
                <strong>
                  ${invoice.customerName || "-"}
                </strong>
              </div>

              <div class="info">
                <span>الهاتف:</span>
                <strong>
                  ${invoice.customerPhone || "-"}
                </strong>
              </div>

            </div>

          </div>

          <table>

            <thead>
              <tr>
                <th>الجهاز</th>
                <th>Serial Number</th>
                <th>الكمية</th>
                <th>السعر</th>
              </tr>
            </thead>

            <tbody>

              <tr>
                <td>
                  ${invoice.deviceName || "-"}
                </td>

                <td>
                  ${invoice.serialNumber || "-"}
                </td>

                <td>
                  ${invoice.quantity || 1}
                </td>

                <td>
                  ${price} جنيه
                </td>
              </tr>

            </tbody>

          </table>

          <div class="total-box">

            <div class="total">

              <div class="total-label">
                الإجمالي
              </div>

              <div class="total-price">
                ${price} جنيه
              </div>

            </div>

          </div>

          <div class="warranty-box">

            <div class="section-title">
              🛡️ بيانات الضمان
            </div>

            <div>
              مدة الضمان:
              <strong>
                ${warrantyText}
              </strong>
            </div>

            <div style="margin-top:8px">
              انتهاء الضمان:
              <strong>
                ${invoice.warrantyEnd || "-"}
              </strong>
            </div>

            <div class="warranty-status">
              الحالة:
              ${warranty.text}
            </div>

          </div>

          <div class="signature">

            <div class="signature-box">
              توقيع العميل
            </div>

            <div class="signature-box">
              ختم المحل
            </div>

          </div>

          <div class="footer">

            <span>
              ABU AL-KHAIR GAMING SHOP
            </span>

            <span>
              شكراً لتعاملكم معنا ❤️
            </span>

          </div>

        </div>

        <script>
          window.onload = function () {
            setTimeout(function () {
              window.print();
            }, 500);
          };
        </script>

      </body>
      </html>
    `);

    printWindow.document.close();
  };

  const filteredInvoices =
    invoices.filter((invoice) => {
      const text = `
        ${invoice.invoiceNumber || ""}
        ${invoice.customerName || ""}
        ${invoice.customerPhone || ""}
        ${invoice.deviceName || ""}
        ${invoice.serialNumber || ""}
      `.toLowerCase();

      return text.includes(
        search.toLowerCase()
      );
    });

  return (
    <main className="dashboard invoices-page">

      <div className="page-header">

        <div>
          <p className="small-title">
            INVOICES
          </p>

          <h2>
            🧾 الفواتير والمبيعات
          </h2>

          <p>
            تسجيل المبيعات ومتابعة ضمان الأجهزة.
          </p>
        </div>

      </div>

      <section className="content-card">

        <div className="card-title">

          <div>
            <h3>
              فاتورة بيع جديدة
            </h3>

            <p>
              سجل الجهاز وتاريخ الشراء والضمان.
            </p>
          </div>

        </div>

        <form
          className="invoice-form"
          onSubmit={saveInvoice}
        >

          <div className="setting-item">
            <label>
              اسم العميل
            </label>

            <input
              type="text"
              value={form.customerName}
              onChange={(e) =>
                updateForm(
                  "customerName",
                  e.target.value
                )
              }
              placeholder="اسم العميل"
            />
          </div>

          <div className="setting-item">
            <label>
              رقم الهاتف
            </label>

            <input
              type="text"
              value={form.customerPhone}
              onChange={(e) =>
                handleCustomerChange(
                  e.target.value
                )
              }
              placeholder="رقم الهاتف"
              list="customerPhones"
            />

            <datalist id="customerPhones">
              {customers.map(
                (customer) => (
                  <option
                    key={customer.id}
                    value={customer.phone}
                  >
                    {customer.name}
                  </option>
                )
              )}
            </datalist>
          </div>

          <div className="setting-item">
            <label>
              الجهاز
            </label>

            <input
              type="text"
              value={form.deviceName}
              onChange={(e) =>
                updateForm(
                  "deviceName",
                  e.target.value
                )
              }
              placeholder="مثال: PS5 Slim"
            />
          </div>

          <div className="setting-item">
            <label>
              Serial Number
            </label>

            <input
              type="text"
              value={form.serialNumber}
              onChange={(e) =>
                updateForm(
                  "serialNumber",
                  e.target.value
                )
              }
              placeholder="Serial Number"
            />
          </div>

          <div className="setting-item">
            <label>
              سعر البيع
            </label>

            <input
              type="number"
              min="0"
              value={form.price}
              onChange={(e) =>
                updateForm(
                  "price",
                  e.target.value
                )
              }
              placeholder="السعر بالجنيه"
            />
          </div>

          <div className="setting-item">
            <label>
              تاريخ الشراء
            </label>

            <input
              type="date"
              value={form.purchaseDate}
              onChange={(e) =>
                updateForm(
                  "purchaseDate",
                  e.target.value
                )
              }
            />
          </div>

          <div className="setting-item">
            <label>
              مدة الضمان
            </label>

            <select
              value={form.warrantyMonths}
              onChange={(e) =>
                updateForm(
                  "warrantyMonths",
                  e.target.value
                )
              }
            >
              <option value="0">
                بدون ضمان
              </option>

              <option value="1">
                شهر واحد
              </option>

              <option value="3">
                3 شهور
              </option>

              <option value="6">
                6 شهور
              </option>

              <option value="12">
                سنة
              </option>

              <option value="24">
                سنتين
              </option>
            </select>
          </div>

          <div className="setting-item">
            <label>
              انتهاء الضمان
            </label>

            <input
              type="date"
              value={calculateWarrantyEnd()}
              readOnly
            />
          </div>

          <button
            type="submit"
            className="main-button"
          >
            🧾 حفظ الفاتورة
          </button>

        </form>

      </section>

      <section className="content-card">

        <div className="card-title">

          <div>
            <h3>
              سجل الفواتير
            </h3>

            <p>
              ابحث عن أي فاتورة أو جهاز أو عميل.
            </p>
          </div>

          <input
            className="invoice-search"
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="🔍 بحث..."
          />

        </div>

        {filteredInvoices.length === 0 ? (
          <div className="empty-state">

            <div className="empty-icon">
              🧾
            </div>

            <h3>
              لا توجد فواتير
            </h3>

            <p>
              الفواتير الجديدة ستظهر هنا.
            </p>

          </div>
        ) : (
          <div className="invoices-list">

            {filteredInvoices.map(
              (invoice) => {
                const warranty =
                  getWarrantyStatus(
                    invoice.warrantyEnd
                  );

                return (
                  <div
                    className="invoice-row"
                    key={
                      invoice.id ||
                      invoice.invoiceNumber
                    }
                  >

                    <div>
                      <small>
                        رقم الفاتورة
                      </small>

                      <strong>
                        {invoice.invoiceNumber ||
                          `#${invoice.id}`}
                      </strong>
                    </div>

                    <div>
                      <small>
                        العميل
                      </small>

                      <strong>
                        {invoice.customerName}
                      </strong>

                      <span>
                        {invoice.customerPhone}
                      </span>
                    </div>

                    <div>
                      <small>
                        الجهاز
                      </small>

                      <strong>
                        {invoice.deviceName}
                      </strong>

                      <span>
                        S/N:{" "}
                        {invoice.serialNumber}
                      </span>
                    </div>

                    <div>
                      <small>
                        الشراء
                      </small>

                      <strong>
                        {invoice.purchaseDate}
                      </strong>
                    </div>

                    <div>
                      <small>
                        انتهاء الضمان
                      </small>

                      <strong>
                        {invoice.warrantyEnd || "-"}
                      </strong>

                      <span
                        className={
                          warranty.className
                        }
                      >
                        {warranty.text}
                      </span>
                    </div>

                    <div>
                      <small>
                        السعر
                      </small>

                      <strong>
                        {Number(
                          invoice.price || 0
                        ).toLocaleString("ar-EG")}{" "}
                        جنيه
                      </strong>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: "10px",
                      }}
                    >
                      <button
                        type="button"
                        className="main-button"
                        onClick={() =>
                          printInvoice(invoice)
                        }
                        style={{
                          padding:
                            "10px 16px",
                          minWidth:
                            "120px",
                        }}
                      >
                        🖨️ طباعة
                      </button>
                    </div>

                  </div>
                );
              }
            )}

          </div>
        )}

      </section>

    </main>
  );
}

export default Invoices;