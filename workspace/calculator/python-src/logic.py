from typing import Union
from operator import add, sub, mul, truediv

class CalculatorError(Exception):
    """Base class for calculator-related exceptions."""
    pass

class DivisionByZeroError(CalculatorError):
    """Raised when division by zero is attempted."""
    pass

class InvalidOperationError(CalculatorError):
    """Raised when an invalid operation is attempted."""
    pass

def add(a: Union[int, float], b: Union[int, float]) -> Union[int, float]:
    """Add two numbers."""
    return a + b

def subtract(a: Union[int, float], b: Union[int, float]) -> Union[int, float]:
    """Subtract two numbers."""
    return a - b

def multiply(a: Union[int, float], b: Union[int, float]) -> Union[int, float]:
    """Multiply two numbers."""
    return a * b

def divide(a: Union[int, float], b: Union[int, float]) -> Union[int, float]:
    """Divide two numbers."""
    if b == 0:
        raise DivisionByZeroError("Cannot divide by zero")
    return a / b

def apply_operation(operator: str, *operands: Union[int, float]) -> Union[int, float]:
    """
    Apply an operation to the given operands.

    Supports the following operators:
    - '+', 'add': addition
    - '-', 'subtract': subtraction
    - '*', 'multiply': multiplication
    - '/', 'divide': division
    - 'neg': negation (only one operand)
    - 'sum': sum of all operands
    - 'product': product of all operands

    Raises:
    - InvalidOperationError: if the operator is not supported
    - DivisionByZeroError: if division by zero is attempted
    """
    operations = {
        '+': add,
        'add': add,
        '-': subtract,
        'subtract': subtract,
        '*': multiply,
        'multiply': multiply,
        '/': divide,
        'divide': divide,
        'neg': lambda x: -x,
        'sum': sum,
        'product': lambda *x: 1 if not x else x[0] * apply_operation('product', *x[1:]),
    }

    if operator not in operations:
        raise InvalidOperationError(f"Invalid operation: {operator}")

    if operator in ['neg', 'sum', 'product']:
        if operator == 'neg' and len(operands) != 1:
            raise InvalidOperationError(f"Negation requires exactly one operand, got {len(operands)}")
        return operations[operator](*operands)
    elif len(operands) != 1:
        result = operands[0]
        for operand in operands[1:]:
            result = operations[operator](result, operand)
        return result
    else:
        raise InvalidOperationError(f"Operation {operator} requires at least two operands, got {len(operands)}")

def calculate_expression(expression_string: str) -> Union[int, float]:
    """
    Evaluate a mathematical expression.

    This is a very basic implementation and only supports the following:
    - Addition and subtraction
    - Multiplication and division
    - Negation
    - No parentheses or complex expressions

    Raises:
    - InvalidOperationError: if the expression is invalid
    """
    # Split the expression into tokens (operators and operands)
    tokens = expression_string.replace('(', '').replace(')', '').split()

    # Initialize the result and the current operator
    result = 0
    operator = '+'

    # Iterate over the tokens
    for token in tokens:
        if token in ['+', '-', '*', '/', 'add', 'subtract', 'multiply', 'divide', 'neg', 'sum', 'product']:
            operator = token
        else:
            # Try to convert the token to a number
            try:
                number = float(token)
            except ValueError:
                raise InvalidOperationError(f"Invalid token: {token}")

            # Apply the current operator to the result and the number
            if operator == '+':
                result += number
            elif operator == '-':
                result -= number
            elif operator == '*':
                result *= number
            elif operator == '/':
                if number == 0:
                    raise DivisionByZeroError("Cannot divide by zero")
                result /= number
            elif operator == 'add':
                result += number
            elif operator == 'subtract':
                result -= number
            elif operator == 'multiply':
                result *= number
            elif operator == 'divide':
                if number == 0:
                    raise DivisionByZeroError("Cannot divide by zero")
                result /= number
            elif operator == 'neg':
                result = -result
            elif operator == 'sum':
                result += number
            elif operator == 'product':
                result *= number

    return result