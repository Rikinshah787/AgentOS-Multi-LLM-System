from logic import Calculator

class CalculatorUI:
    def __init__(self):
        self.calc = Calculator()

    def display(self):
        print(f"Current: {self.calc.current_value}")
        if self.calc.operation:
            print(f"Operation: {self.calc.operation}")
        print("---")

    def run(self):
        print("Calculator (type 'exit' to quit, 'reset' to clear)")
        while True:
            self.display()
            user_input = input("Enter number or operation (+, -, *, /, =): ").strip()

            if user_input.lower() == "exit":
                break
            elif user_input.lower() == "reset":
                self.calc.reset()
                continue

            try:
                if user_input in "+-*/":
                    self.calc.apply_operation(float(self.calc.current_value), user_input)
                elif user_input == "=":
                    self.calc.apply_operation(float(self.calc.current_value))
                else:
                    num = float(user_input)
                    if self.calc.operation:
                        self.calc.apply_operation(num)
                    else:
                        self.calc.current_value = num
            except ValueError as e:
                print(f"Error: {e}")