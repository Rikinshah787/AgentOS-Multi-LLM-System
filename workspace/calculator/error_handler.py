class CalculatorError(Exception):
    """Base class for calculator-related exceptions."""
    pass

class InvalidInputError(CalculatorError):
    """Raised when the input is invalid."""
    pass

class CalculationError(CalculatorError):
    """Raised when a calculation fails."""
    pass