"""
Calculator UI Module
Provides a Tkinter-based graphical user interface for the calculator.
"""

import tkinter as tk
from tkinter import messagebox
from logic import calculate


class CalculatorUI:
    """A graphical calculator using Tkinter."""
    
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Calculator")
        self.root.geometry("300x400")
        self.root.resizable(False, False)
        
        self.current_input = ""
        self.history = []
        self.last_result = None
        
        self._create_widgets()
    
    def _create_widgets(self):
        """Create all UI widgets."""
        # Display
        self.display_var = tk.StringVar(value="0")
        display = tk.Entry(
            self.root,
            textvariable=self.display_var,
            font=('Arial', 24),
            justify='right',
            state='readonly'
        )
        display.pack(fill='x', padx=10, pady=10)
        
        # History label
        self.history_var = tk.StringVar(value="")
        history_label = tk.Label(
            self.root,
            textvariable=self.history_var,
            font=('Arial', 10),
            anchor='e'
        )
        history_label.pack(fill='x', padx=10)
        
        # Button frame
        button_frame = tk.Frame(self.root)
        button_frame.pack(expand=True, fill='both', padx=10, pady=10)
        
        # Button layout
        buttons = [
            ['C', '←', '%', '/'],
            ['7', '8', '9', '*'],
            ['4', '5', '6', '-'],
            ['1', '2', '3', '+'],
            ['0', '.', '=', '^']
        ]
        
        for row_idx, row in enumerate(buttons):
            for col_idx, text in enumerate(row):
                btn = tk.Button(
                    button_frame,
                    text=text,
                    font=('Arial', 18),
                    command=lambda t=text: self._on_button_click(t)
                )
                btn.grid(row=row_idx, column=col_idx, sticky='nsew', padx=2, pady=2)
                button_frame.grid_columnconfigure(col_idx, weight=1)
            button_frame.grid_rowconfigure(row_idx, weight=1)
    
    def _on_button_click(self, button: str):
        """Handle button clicks."""
        if button.isdigit():
            self._input_digit(button)
        elif button == '.':
            self._input_decimal()
        elif button in ['+', '-', '*', '/', '%', '^']:
            self._input_operator(button)
        elif button == '=':
            self._calculate()
        elif button == 'C':
            self._clear()
        elif button == '←':
            self._backspace()
    
    def _input_digit(self, digit: str):
        """Input a digit."""
        if self.current_input == "0" or self.current_input == "":
            self.current_input = digit
        else:
            self.current_input += digit
        self._update_display()
    
    def _input_decimal(self):
        """Input a decimal point."""
        parts = self.current_input.replace('-', '+').split('+')
        parts = [p for p in self.current_input.replace('*', '+').replace('/', '+').replace('^', '+').replace('%', '+').split('+')]
        last_part = parts[-1] if parts else ""
        
        if '.' not in last_part:
            self.current_input += '.'
            self._update_display()
    
    def _input_operator(self, op: str):
        """Input an operator."""
        if self.current_input and self.current_input[-1] not in ['+', '-', '*', '/', '%', '^']:
            self.current_input += op
            self._update_display()
    
    def _calculate(self):
        """Perform the calculation."""
        if not self.current_input:
            return
        
        try:
            # Parse and calculate
            expression = self.current_input
            result = self._evaluate_expression(expression)
            
            # Store in history
            self.history.append(f"{expression} = {result}")
            self.last_result = result
            
            # Update display
            self.current_input = str(result)
            self.history_var.set(expression + " =")
            self._update_display()
            
        except Exception as e:
            messagebox.showerror("Error", str(e))
    
    def _evaluate_expression(self, expr: str) -> float:
        """Evaluate a simple expression."""
        operators = ['+', '-', '*', '/', '%', '^']
        
        for op in operators:
            if op in expr:
                parts = expr.rsplit(op, 1)
                if len(parts) == 2:
                    a = float(parts[0])
                    b = float(parts[1])
                    return calculate(op, a, b)
        
        return float(expr)
    
    def _clear(self):
        """Clear the calculator."""
        self.current_input = ""
        self.history_var.set("")
        self._update_display()
    
    def _backspace(self):
        """Remove the last character."""
        self.current_input = self.current_input[:-1]
        self._update_display()
    
    def _update_display(self):
        """Update the display with current input."""
        self.display_var.set(self.current_input if self.current_input else "0")
    
    def run(self):
        """Start the calculator UI."""
        self.root.mainloop()


if __name__ == "__main__":
    calculator = CalculatorUI()
    calculator.run()