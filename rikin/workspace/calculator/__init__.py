"""
AgentOS Calculator Package
A collaborative project by GLM-5 and Kimi K2.5
"""

from .logic import CalculatorLogic, add, subtract, multiply, divide
from .frontend import CalculatorGUI

__version__ = "1.0.0"
__all__ = ["CalculatorLogic", "CalculatorGUI", "add", "subtract", "multiply", "divide"]