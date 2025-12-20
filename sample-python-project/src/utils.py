"""
Sample utility functions for demonstrating AutoTypeScript type inference for Python
"""


def greet(name, age, options=None):
    """Greets a user with optional formal style"""
    if options and options.get('formal'):
        title = options.get('title', '')
        return f"Good day, {title} {name}. You are {age} years old."
    return f"Hey {name}! You're {age}!"


def calculate_total(items, discount=None):
    """Calculates the total price with optional discount"""
    subtotal = sum(item['price'] * item['quantity'] for item in items)
    if discount:
        return subtotal * (1 - discount)
    return subtotal


def format_user(user):
    """Formats user data for display"""
    return {
        'displayName': f"{user['firstName']} {user['lastName']}",
        'email': user['email'],
        'age': user['age'],
        'isActive': user.get('active', True)
    }


def process_numbers(numbers, operation):
    """Processes an array of numbers"""
    if operation == 'sum':
        return sum(numbers)
    elif operation == 'avg':
        return sum(numbers) / len(numbers)
    elif operation == 'max':
        return max(numbers)
    elif operation == 'min':
        return min(numbers)
    else:
        return numbers


def create_task(title, priority='medium', assignee=None):
    """Creates a new task object"""
    import random
    import string
    from datetime import datetime
    
    task_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))
    return {
        'id': task_id,
        'title': title,
        'priority': priority,
        'assignee': assignee,
        'createdAt': datetime.now().isoformat(),
        'completed': False
    }


def filter_items(items, criteria):
    """Filters items based on criteria"""
    result = []
    for item in items:
        if 'minPrice' in criteria and item['price'] < criteria['minPrice']:
            continue
        if 'maxPrice' in criteria and item['price'] > criteria['maxPrice']:
            continue
        if 'category' in criteria and item['category'] != criteria['category']:
            continue
        if 'inStock' in criteria and item['inStock'] != criteria['inStock']:
            continue
        result.append(item)
    return result


def merge_config(defaults, overrides):
    """Merges configuration dictionaries"""
    return {**defaults, **overrides}
