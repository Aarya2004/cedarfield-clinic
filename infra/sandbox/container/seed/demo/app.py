def greet(name: str) -> str:
    return "Hello, " + name


def total(prices: list[float]) -> float:
    # bug on purpose: the demo's recovery beat fixes this line
    return sum(prices) - 1
