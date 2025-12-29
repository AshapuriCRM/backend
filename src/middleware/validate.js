const { body, validationResult } = require("express-validator");

const validate = (req, res, next) => {
  console.log(
    "> [validate middleware] Request body:",
    JSON.stringify(req.body)
  );
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const extractedErrors = [];
    errors.array().map((err) =>
      extractedErrors.push({
        field: err.path || err.param,
        message: err.msg,
      })
    );
    console.log("> [validate middleware] Validation errors:", extractedErrors);
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: extractedErrors,
    });
  }
  console.log("> [validate middleware] Validation passed");
  next();
};

// Invoice update validation
const validateInvoiceUpdate = [
  body("status")
    .optional()
    .isIn(["draft", "sent", "paid", "overdue", "cancelled"])
    .withMessage("Invalid status value"),
  body("paymentStatus")
    .optional()
    .isIn(["pending", "partial", "paid", "failed"])
    .withMessage("Invalid payment status value"),
  body("billTo.name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Bill to name must be between 2 and 100 characters"),
  body("billTo.gstNumber")
    .optional()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage("Invalid GST number format"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot be more than 1000 characters"),
  validate,
];

module.exports = {
  validate,
  validateInvoiceUpdate,
};
