"""
Unit tests for the Calculator Logic Module.
Run with: pytest test_logic.py -v
"""

import pytest
from logic import add, subtract, multiply, divide, power, modulo, calculate


class TestAdd:
    """Tests for the add function."""
    
    def test_add_positive_numbers(self):
        assert add(5, 3) == 8
    
    def test_add_negative_numbers(self):
        assert add(-5, -3) == -8
    
    def test_add_mixed_numbers(self):
        assert add(-5, 3) == -2
        assert add(5, -3) == 2
    
    def test_add_zero(self):
        assert add(5, 0) == 5
        assert add(0, 5) == 5
    
    def test_add_floats(self):
        assert add(2.5, 3.5) == 6.0


class TestSubtract:
    """Tests for the subtract function."""
    
    def test_subtract_positive_numbers(self):
        assert subtract(10, 4) == 6
    
    def test_subtract_negative_numbers(self):
        assert subtract(-10, -4) == -6
    
    def test_subtract_result_negative(self):
        assert subtract(4, 10) == -6
    
    def test_subtract_zero(self):
        assert subtract(5, 0) == 5


class TestMultiply:
    """Tests for the multiply function."""
    
    def test_multiply_positive_numbers(self):
        assert multiply(6, 7) == 42
    
    def test_multiply_negative_numbers(self):
        assert multiply(-6, -7) == 42
    
    def test_multiply_mixed_signs(self):
        assert multiply(-6, 7) == -42
        assert multiply(6, -7) == -42
    
    def test_multiply_by_zero(self):
        assert multiply(100, 0) == 0


class TestDivide:
    """Tests for the divide function."""
    
    def test_divide_positive_numbers(self):
        assert divide(20, 4) == 5
    
    def test_divide_negative_numbers(self):
        assert divide(-20, -4) == 5
    
    def test_divide_mixed_signs(self):
        assert divide(-20, 4) == -5
    
    def test_divide_by_zero_raises_error(self):
        with pytest.raises(ValueError, match="Cannot divide by zero"):
            divide(10, 0)
    
    def test_divide_floats(self):
        assert divide(7, 2) == 3.5


class TestPower:
    """Tests for the power function."""
    
    def test_power_positive_exponent(self):
        assert power(2, 8) == 256
    
    def test_power_zero_exponent(self):
        assert power(5, 0) == 1
    
    def test_power_negative_exponent(self):
        assert power(2, -1) == 0.5
    
    def test_power_fractional_exponent(self):
        assert power(4, 0.5) == 2.0


class TestModulo:
    """Tests for the modulo function."""
    
    def test_modulo_positive_numbers(self):
        assert modulo(10, 3) == 1
    
    def test_modulo_by_zero_raises_error(self):
        with pytest.raises(ValueError, match="Cannot modulo by zero"):
            modulo(10, 0)
    
    def test_modulo_negative_dividend(self):
        assert modulo(-10, 3) == 2  # Python's modulo behavior


class TestCalculate:
    """Tests for the calculate function."""
    
    def test_calculate_add(self):
        assert calculate('+', 5, 3) == 8
    
    def test_calculate_subtract(self):
        assert calculate('-', 10, 4) == 6
    
    def test_calculate_multiply(self):
        assert calculate('*', 6, 7) == 42
    
    def test_calculate_divide(self):
        assert calculate('/', 20, 4) == 5
    
    def test_calculate_power(self):
        assert calculate('^', 2, 8) == 256
    
    def test_calculate_modulo(self):
        assert calculate('%', 10, 3) == 1
    
    def test_calculate_invalid_operation(self):
        with pytest.raises(ValueError, match="Unknown operation"):
            calculate('x', 5, 3)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])