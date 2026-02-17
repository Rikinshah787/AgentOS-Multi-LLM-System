import pytest
from calculator.logic import add, subtract, multiply, divide, sqrt, sin, cos, tan

def test_add():
    assert add(1, 2) == 3
    assert add(-1, 1) == 0
    assert add(-1, -1) == -2

def test_subtract():
    assert subtract(1, 2) == -1
    assert subtract(-1, 1) == -2
    assert subtract(-1, -1) == 0

def test_multiply():
    assert multiply(1, 2) == 2
    assert multiply(-1, 1) == -1
    assert multiply(-1, -1) == 1

def test_divide():
    assert divide(1, 2) == 0.5
    assert divide(-1, 2) == -0.5
    assert divide(-1, -2) == 0.5

def test_divide_by_zero():
    with pytest.raises(ZeroDivisionError):
        divide(1, 0)

def test_sqrt():
    assert sqrt(4) == 2
    assert sqrt(0) == 0
    with pytest.raises(ValueError):
        sqrt(-1)

def test_sin():
    assert sin(0) == 0
    assert sin(3.14159 / 2) == 1
    assert sin(3.14159) == 0

def test_cos():
    assert cos(0) == 1
    assert cos(3.14159 / 2) == 0
    assert cos(3.14159) == -1

def test_tan():
    assert tan(0) == 0
    assert tan(3.14159 / 4) == 1
    with pytest.raises(ZeroDivisionError):
        tan(3.14159 / 2)

def test_advanced_functions():
    assert sqrt(16) == 4
    assert sin(3.14159) == 0
    assert cos(3.14159) == -1
    assert tan(3.14159 / 4) == 1