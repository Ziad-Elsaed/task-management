const { validationResult } = require('express-validator');

module.exports = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        // send all error messages in array to client

        return res.status(400).json({
            message: errors.array().map(err => err.msg)
        });
    }

    next();
};