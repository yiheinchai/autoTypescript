"""
Tests for utility functions
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from utils import (
    greet,
    calculate_total,
    format_user,
    process_numbers,
    create_task,
    filter_items,
    merge_config
)


def test_greet():
    """Test greet function"""
    result = greet("Alice", 30)
    assert "Alice" in result
    assert "30" in result


def test_greet_formal():
    """Test greet with formal options"""
    result = greet("Bob", 45, {'formal': True})
    assert "Good day" in result


def test_greet_with_title():
    """Test greet with title"""
    result = greet("Smith", 50, {'formal': True, 'title': 'Dr.'})
    assert "Dr." in result


def test_calculate_total():
    """Test calculate_total without discount"""
    items = [
        {'name': 'Apple', 'price': 1.5, 'quantity': 3},
        {'name': 'Banana', 'price': 0.75, 'quantity': 6}
    ]
    total = calculate_total(items)
    assert total == 9.0


def test_calculate_total_with_discount():
    """Test calculate_total with discount"""
    items = [
        {'name': 'Laptop', 'price': 1000, 'quantity': 1},
        {'name': 'Mouse', 'price': 50, 'quantity': 2}
    ]
    total = calculate_total(items, 0.1)
    assert total == 990.0


def test_format_user():
    """Test format_user"""
    user = {
        'firstName': 'John',
        'lastName': 'Doe',
        'email': 'john@example.com',
        'age': 28,
        'active': True
    }
    formatted = format_user(user)
    assert formatted['displayName'] == 'John Doe'
    assert formatted['email'] == 'john@example.com'
    assert formatted['isActive'] == True


def test_process_numbers_sum():
    """Test process_numbers sum"""
    result = process_numbers([1, 2, 3, 4, 5], 'sum')
    assert result == 15


def test_process_numbers_avg():
    """Test process_numbers average"""
    result = process_numbers([10, 20, 30], 'avg')
    assert result == 20.0


def test_create_task():
    """Test create_task"""
    task = create_task("Fix bug")
    assert task['title'] == "Fix bug"
    assert task['priority'] == 'medium'
    assert task['assignee'] is None
    assert 'id' in task


def test_filter_items():
    """Test filter_items"""
    items = [
        {'name': 'Shirt', 'price': 25, 'category': 'clothing', 'inStock': True},
        {'name': 'Pants', 'price': 50, 'category': 'clothing', 'inStock': False},
        {'name': 'Phone', 'price': 500, 'category': 'electronics', 'inStock': True}
    ]
    
    result = filter_items(items, {'minPrice': 100})
    assert len(result) == 1
    assert result[0]['name'] == 'Phone'


def test_merge_config():
    """Test merge_config"""
    defaults = {'debug': False, 'timeout': 5000, 'retries': 3}
    overrides = {'debug': True, 'timeout': 10000}
    result = merge_config(defaults, overrides)
    assert result['debug'] == True
    assert result['timeout'] == 10000
    assert result['retries'] == 3


if __name__ == '__main__':
    # Run all tests
    test_greet()
    test_greet_formal()
    test_greet_with_title()
    test_calculate_total()
    test_calculate_total_with_discount()
    test_format_user()
    test_process_numbers_sum()
    test_process_numbers_avg()
    test_create_task()
    test_filter_items()
    test_merge_config()
    print("All tests passed!")
