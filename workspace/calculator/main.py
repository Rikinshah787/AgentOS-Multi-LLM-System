#!/usr/bin/env python3
"""
Calculator Application Entry Point
Unifies logic and UI modules into a runnable application.
"""

from logic import add, subtract, multiply, divide, power, sqrt
from ui import CalculatorUI

def main():
    """Main entry point for the calculator application."""
    print("=" * 50)
    print("  WELCOME TO MULTI-AGENT CALCULATOR")
    print("  (Python Edition - Unified Build)")
    print("=" * 50)
    
    calc = CalculatorUI()
    
    # Run demo calculations
    print("\n📊 Running Demo Calculations:")
    print("-" * 30)
    
    test_cases = [
        ("10 + 5", lambda: add(10, 5)),
        ("10 - 5", lambda: subtract(10, 5)),
        ("10 * 5", lambda: multiply(10, 5)),
        ("10 / 5", lambda: divide(10, 5)),
        ("2 ^ 8", lambda: power(2, 8)),
        ("√144", lambda: sqrt(144)),
    ]
    
    for desc, operation in test_cases:
        try:
            result = operation()
            print(f"  {desc} = {result}")
            calc.add_to_history(desc, result)
        except Exception as e:
            print(f"  {desc} = Error: {e}")
    
    print("-" * 30)
    print(f"\n📜 Calculation History ({len(calc.history)} items):")
    for item in calc.history:
        print(f"   {item}")
    
    print("\n✅ Calculator ready for use!")
    print("Import this module or run interactively:")
    print("  from main import calc")
    print("  calc.calculate('15 + 25')")

if __name__ == "__main__":
    main()