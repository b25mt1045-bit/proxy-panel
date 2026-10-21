# Segment presets. Seeds are (name, type) and are resolved through Qloo search (checked live on day 2).
# Ages must be in config.AGE_BUCKETS.
PRESETS = {
    "genz_urban_fitness": {
        "label": "Gen Z urban fitness", "age": "24_and_younger",
        "seeds": [("Gymshark", "brand"), ("Alo Yoga", "brand"), ("Celsius", "brand"), ("Huberman Lab", "podcast")],
    },
    "health_parents": {
        "label": "Health-conscious parents 35–55", "age": "35_to_44",
        "seeds": [("Whole Foods Market", "brand"), ("The Honest Company", "brand"), ("Peloton", "brand"),
                  ("The goop Podcast", "podcast")],
    },
    "millennial_wellness": {
        "label": "Millennial wellness professionals", "age": "30_to_34",
        "seeds": [("Athletic Greens", "brand"), ("Lululemon", "brand"), ("Calm", "brand"),
                  ("The Mel Robbins Podcast", "podcast")],
    },
    "budget_students": {
        "label": "Budget-minded students", "age": "24_and_younger",
        "seeds": [("Target", "brand"), ("Spotify", "brand"), ("Monster Energy", "brand"), ("Call Her Daddy", "podcast")],
    },
}

# The 3 example briefs (functional beverage, clean personal care, consumer app), in POST /runs shape.
EXAMPLE_BRIEFS = [
    {
        "description": "A prebiotic sparkling soda with 5g sugar and adaptogens, sold in 12oz cans",
        "category": "beverage", "price": 3.29,
        "variants": [{"key": "A", "name": "Calm Fizz", "positioning": "Relaxation"},
                     {"key": "B", "name": "Bolt", "positioning": "Focus", "price": 3.79}],
        "segments": [{"preset_id": "genz_urban_fitness"}, {"preset_id": "millennial_wellness"},
                     {"text": "remote tech workers in their 30s"}],
    },
    {
        "description": "A refillable aluminium deodorant case with plastic-free, aluminium-free refills",
        "category": "personal_care", "price": 14.0,
        "variants": [{"key": "A", "name": "Refill Club"}],
        "segments": [{"preset_id": "health_parents"}, {"text": "eco-conscious renters who shop at farmers markets"}],
    },
    {
        "description": "A habit-tracking app that pairs you with a friend who sees your streaks, priced per month",
        "category": "app", "price": 4.99,
        "variants": [{"key": "A", "name": "Buddy Streaks"}],
        "segments": [{"preset_id": "budget_students"}, {"preset_id": "genz_urban_fitness"}],
    },
]
