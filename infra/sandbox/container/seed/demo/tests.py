from app import greet, total


def test_greet():
    assert greet("judge") == "Hello, judge"


def test_total():
    assert total([1.0, 2.0, 3.0]) == 6.0
